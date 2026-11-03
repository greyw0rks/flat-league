// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice Creator-funded skill competitions. The disclosed signer judges offchain results.
/// Registration and claimFor may be sponsored; reward recipients cannot be redirected.
contract CompetitionManager is EIP712, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status { Funded, Finalized, Cancelled, Refunded }
    struct Config {
        bytes32 rulesHash;
        bytes32 questionCommitment;
        uint64 startAt;
        uint64 endAt;
        uint64 finalizeBy;
        uint32 maxParticipants;
    }
    struct Competition {
        address creator;
        bytes32 rulesHash;
        bytes32 questionCommitment;
        address resultSigner;
        address registrar;
        uint256 pool;
        uint64 startAt;
        uint64 endAt;
        uint64 finalizeBy;
        uint32 maxParticipants;
        uint32 participantCount;
        Status status;
    }
    struct Payout { address winner; uint16 score; uint32 elapsedMs; uint256 amount; }
    struct Result {
        uint256 competitionId;
        bytes32 rulesHash;
        bytes32 resultArtifactHash;
        bytes32 payoutsHash;
        uint256 nonce;
        uint64 validUntil;
    }
    struct NoContest {
        uint256 competitionId;
        bytes32 rulesHash;
        bytes32 resultArtifactHash;
        uint256 nonce;
        uint64 validUntil;
    }

    bytes32 public constant PAYOUT_TYPEHASH = keccak256("Payout(address winner,uint16 score,uint32 elapsedMs,uint256 amount)");
    bytes32 public constant RESULT_TYPEHASH = keccak256("Result(uint256 competitionId,bytes32 rulesHash,bytes32 resultArtifactHash,bytes32 payoutsHash,uint256 nonce,uint64 validUntil)");
    bytes32 public constant NO_CONTEST_TYPEHASH = keccak256("NoContest(uint256 competitionId,bytes32 rulesHash,bytes32 resultArtifactHash,uint256 nonce,uint64 validUntil)");

    IERC20 public immutable wif;
    address public defaultSigner;
    address public defaultRegistrar;
    uint256 public competitionCount;
    uint256 public totalLiabilities;
    mapping(uint256 => Competition) private _competitions;
    mapping(uint256 => mapping(address => bool)) public participants;
    mapping(uint256 => mapping(address => uint256)) public claimable;
    mapping(uint256 => uint256) public resultNonce;

    error InvalidConfig();
    error UnknownCompetition();
    error InvalidState();
    error Unauthorized();
    error InvalidParticipant();
    error RegistrationClosed();
    error InvalidResult();
    error InvalidSignature();
    error NothingToClaim();
    error UnsupportedTokenBehavior();

    event CompetitionCreated(uint256 indexed id, address indexed creator, uint256 pool, bytes32 rulesHash, bytes32 questionCommitment);
    event ParticipantRegistered(uint256 indexed id, address indexed player);
    event CompetitionFinalized(uint256 indexed id, bytes32 indexed artifactHash, bytes32 payoutsHash);
    event RewardAllocated(uint256 indexed id, address indexed winner, uint16 score, uint32 elapsedMs, uint256 amount);
    event RewardClaimed(uint256 indexed id, address indexed winner, uint256 amount);
    event CompetitionRefunded(uint256 indexed id, address indexed creator, uint256 amount, Status status);
    event AuthoritiesUpdated(address signer, address registrar);

    constructor(IERC20 token, address signer, address registrar)
        EIP712("FlatLeague", "1") Ownable(msg.sender)
    {
        if (address(token).code.length == 0 || signer == address(0) || registrar == address(0)) revert InvalidConfig();
        wif = token;
        defaultSigner = signer;
        defaultRegistrar = registrar;
    }

    function setAuthorities(address signer, address registrar) external onlyOwner {
        if (signer == address(0) || registrar == address(0)) revert InvalidConfig();
        defaultSigner = signer;
        defaultRegistrar = registrar;
        emit AuthoritiesUpdated(signer, registrar);
    }

    function getCompetition(uint256 id) external view returns (Competition memory) {
        return _competition(id);
    }

    function createCompetition(Config calldata cfg, uint256 amount) external nonReentrant returns (uint256 id) {
        if (amount == 0 || cfg.rulesHash == bytes32(0) || cfg.questionCommitment == bytes32(0)
            || cfg.startAt <= block.timestamp || cfg.endAt < cfg.startAt + 120
            || cfg.endAt > cfg.startAt + 7 days || cfg.finalizeBy <= cfg.endAt
            || cfg.finalizeBy > cfg.endAt + 7 days || cfg.maxParticipants == 0
            || cfg.maxParticipants > 1000) revert InvalidConfig();
        uint256 beforeBalance = wif.balanceOf(address(this));
        wif.safeTransferFrom(msg.sender, address(this), amount);
        if (wif.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedTokenBehavior();
        id = ++competitionCount;
        _competitions[id] = Competition({
            creator: msg.sender, rulesHash: cfg.rulesHash, questionCommitment: cfg.questionCommitment,
            resultSigner: defaultSigner, registrar: defaultRegistrar, pool: amount,
            startAt: cfg.startAt, endAt: cfg.endAt, finalizeBy: cfg.finalizeBy,
            maxParticipants: cfg.maxParticipants, participantCount: 0, status: Status.Funded
        });
        totalLiabilities += amount;
        emit CompetitionCreated(id, msg.sender, amount, cfg.rulesHash, cfg.questionCommitment);
    }

    function registerParticipant(uint256 id, address player) external {
        Competition storage c = _competition(id);
        if (msg.sender != c.registrar) revert Unauthorized();
        if (c.status != Status.Funded || block.timestamp < c.startAt || block.timestamp >= c.endAt) revert RegistrationClosed();
        if (player == address(0) || participants[id][player] || c.participantCount >= c.maxParticipants) revert InvalidParticipant();
        participants[id][player] = true;
        ++c.participantCount;
        emit ParticipantRegistered(id, player);
    }

    function hashPayouts(Payout[] calldata payouts) public pure returns (bytes32) {
        bytes32[] memory hashes = new bytes32[](payouts.length);
        for (uint256 i; i < payouts.length; ++i) {
            Payout calldata p = payouts[i];
            hashes[i] = keccak256(abi.encode(PAYOUT_TYPEHASH, p.winner, p.score, p.elapsedMs, p.amount));
        }
        return keccak256(abi.encodePacked(hashes));
    }

    function resultDigest(Result calldata r) external view returns (bytes32) {
        return _hashTypedDataV4(_resultHash(r));
    }

    function noContestDigest(NoContest calldata r) external view returns (bytes32) {
        return _hashTypedDataV4(_noContestHash(r));
    }

    function finalizeCompetition(uint256 id, Result calldata r, Payout[] calldata payouts, bytes calldata signature) external nonReentrant {
        Competition storage c = _competition(id);
        _validateSettlement(c, id, r.competitionId, r.rulesHash, r.nonce, r.validUntil);
        if (payouts.length == 0 || payouts.length > 3 || r.resultArtifactHash == bytes32(0) || r.payoutsHash != hashPayouts(payouts)) revert InvalidResult();
        if (ECDSA.recover(_hashTypedDataV4(_resultHash(r)), signature) != c.resultSigner) revert InvalidSignature();
        uint256 total;
        for (uint256 i; i < payouts.length; ++i) {
            Payout calldata p = payouts[i];
            if (p.winner == address(0) || !participants[id][p.winner] || p.score > 100 || p.score % 10 != 0 || p.elapsedMs > 120_000) revert InvalidResult();
            for (uint256 j; j < i; ++j) if (payouts[j].winner == p.winner) revert InvalidResult();
            total += p.amount;
        }
        if (total != c.pool) revert InvalidResult();
        c.status = Status.Finalized;
        ++resultNonce[id];
        for (uint256 i; i < payouts.length; ++i) {
            Payout calldata p = payouts[i];
            claimable[id][p.winner] = p.amount;
            emit RewardAllocated(id, p.winner, p.score, p.elapsedMs, p.amount);
        }
        emit CompetitionFinalized(id, r.resultArtifactHash, r.payoutsHash);
    }

    function claimReward(uint256 id) external nonReentrant { _claim(id, msg.sender); }
    function claimFor(uint256 id, address winner) external nonReentrant { _claim(id, winner); }

    function cancelCompetition(uint256 id) external nonReentrant {
        Competition storage c = _competition(id);
        if (msg.sender != c.creator) revert Unauthorized();
        if (c.status != Status.Funded || block.timestamp >= c.startAt) revert InvalidState();
        _refund(id, c, Status.Cancelled);
    }

    function refundExpiredCompetition(uint256 id) external nonReentrant {
        Competition storage c = _competition(id);
        if (msg.sender != c.creator) revert Unauthorized();
        if (c.status != Status.Funded || block.timestamp < c.finalizeBy) revert InvalidState();
        _refund(id, c, Status.Refunded);
    }

    function refundNoContest(uint256 id, NoContest calldata r, bytes calldata signature) external nonReentrant {
        Competition storage c = _competition(id);
        _validateSettlement(c, id, r.competitionId, r.rulesHash, r.nonce, r.validUntil);
        if (r.resultArtifactHash == bytes32(0)) revert InvalidResult();
        if (ECDSA.recover(_hashTypedDataV4(_noContestHash(r)), signature) != c.resultSigner) revert InvalidSignature();
        ++resultNonce[id];
        _refund(id, c, Status.Refunded);
    }

    function _claim(uint256 id, address winner) private {
        if (_competition(id).status != Status.Finalized) revert InvalidState();
        uint256 amount = claimable[id][winner];
        if (amount == 0) revert NothingToClaim();
        claimable[id][winner] = 0;
        totalLiabilities -= amount;
        wif.safeTransfer(winner, amount);
        emit RewardClaimed(id, winner, amount);
    }

    function _refund(uint256 id, Competition storage c, Status status) private {
        c.status = status;
        totalLiabilities -= c.pool;
        wif.safeTransfer(c.creator, c.pool);
        emit CompetitionRefunded(id, c.creator, c.pool, status);
    }

    function _competition(uint256 id) private view returns (Competition storage c) {
        c = _competitions[id];
        if (c.creator == address(0)) revert UnknownCompetition();
    }

    function _validateSettlement(Competition storage c, uint256 id, uint256 resultId, bytes32 rulesHash, uint256 nonce, uint64 validUntil) private view {
        if (c.status != Status.Funded) revert InvalidState();
        if (block.timestamp < c.endAt || block.timestamp >= c.finalizeBy || block.timestamp >= validUntil
            || validUntil > c.finalizeBy || id != resultId || c.rulesHash != rulesHash || nonce != resultNonce[id]) revert InvalidResult();
    }

    function _resultHash(Result calldata r) private pure returns (bytes32) {
        return keccak256(abi.encode(RESULT_TYPEHASH, r.competitionId, r.rulesHash, r.resultArtifactHash, r.payoutsHash, r.nonce, r.validUntil));
    }
    function _noContestHash(NoContest calldata r) private pure returns (bytes32) {
        return keccak256(abi.encode(NO_CONTEST_TYPEHASH, r.competitionId, r.rulesHash, r.resultArtifactHash, r.nonce, r.validUntil));
    }
}
