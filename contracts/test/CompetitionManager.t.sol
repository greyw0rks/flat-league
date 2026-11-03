// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {CompetitionManager as CM} from "../src/CompetitionManager.sol";
import {MockWIF} from "../src/MockWIF.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface Vm {
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
    function expectRevert() external;
    function chainId(uint256) external;
}

contract TransferGateWIF is MockWIF {
    address public blocked;
    bool public fee;
    function blockRecipient(address a) external { blocked = a; }
    function enableFee() external { fee = true; }
    function _update(address from, address to, uint256 amount) internal override {
        require(to != blocked || to == address(0), "blocked transfer");
        if (fee && from != address(0) && to != address(0)) {
            super._update(from, address(0), amount / 10);
            super._update(from, to, amount - amount / 10);
        } else super._update(from, to, amount);
    }
}

contract CompetitionManagerTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 constant SIGNER_KEY = 0x12345;
    CM manager;
    TransferGateWIF token;
    address creator = address(0xCAFE);
    address player = address(0xBEEF);
    address second = address(0xBABE);
    address registrar = address(0xABCD);

    function setUp() public {
        vm.warp(1000);
        token = new TransferGateWIF();
        manager = new CM(IERC20(address(token)), vm.addr(SIGNER_KEY), registrar);
        token.mint(creator, 10_000 ether);
        vm.prank(creator); token.approve(address(manager), type(uint256).max);
    }
    function _create(uint256 amount) private returns (uint256) {
        CM.Config memory cfg = CM.Config(keccak256("rules"), keccak256("questions+salt"), 1100, 1500, 2000, 100);
        vm.prank(creator); return manager.createCompetition(cfg, amount);
    }
    function _register(uint256 id, address p) private {
        vm.warp(1100); vm.prank(registrar); manager.registerParticipant(id, p);
    }
    function _result(uint256 id, CM.Payout[] memory payouts) private view returns (CM.Result memory) {
        return CM.Result(id, keccak256("rules"), keccak256("artifact"), manager.hashPayouts(payouts), manager.resultNonce(id), 1999);
    }
    function _sign(CM.Result memory r) private returns (bytes memory) {
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(SIGNER_KEY, manager.resultDigest(r));
        return abi.encodePacked(rr, s, v);
    }
    function _finalize(uint256 id, uint256 amount) private {
        CM.Payout[] memory payouts = new CM.Payout[](1);
        payouts[0] = CM.Payout(player, 100, 50_000, amount);
        CM.Result memory r = _result(id, payouts);
        bytes memory signature = _sign(r);
        vm.warp(1500); manager.finalizeCompetition(id, r, payouts, signature);
    }
    function testLifecycleAndSponsoredClaimCannotRedirect() public {
        uint256 id = _create(250 ether); _register(id, player); _finalize(id, 250 ether);
        require(manager.totalLiabilities() == 250 ether);
        vm.prank(second); manager.claimFor(id, player);
        require(token.balanceOf(player) == 250 ether && token.balanceOf(second) == 0);
        require(manager.totalLiabilities() == 0 && manager.claimable(id, player) == 0);
        vm.expectRevert(CM.NothingToClaim.selector); manager.claimFor(id, player);
    }
    function testRegistrationAuthorityAndDuplicate() public {
        uint256 id = _create(100 ether); vm.warp(1100);
        vm.expectRevert(CM.Unauthorized.selector); manager.registerParticipant(id, player);
        vm.prank(registrar); manager.registerParticipant(id, player);
        vm.prank(registrar); vm.expectRevert(CM.InvalidParticipant.selector); manager.registerParticipant(id, player);
        vm.warp(1500); vm.prank(registrar); vm.expectRevert(CM.RegistrationClosed.selector); manager.registerParticipant(id, second);
    }
    function testRejectNonparticipantAndOverAllocation() public {
        uint256 id = _create(100 ether); _register(id, player);
        CM.Payout[] memory p = new CM.Payout[](1); p[0] = CM.Payout(second, 100, 1000, 100 ether);
        CM.Result memory r = _result(id, p); bytes memory sig = _sign(r); vm.warp(1500);
        vm.expectRevert(CM.InvalidResult.selector); manager.finalizeCompetition(id, r, p, sig);
        p[0] = CM.Payout(player, 100, 1000, 101 ether); r = _result(id, p); sig = _sign(r);
        vm.expectRevert(CM.InvalidResult.selector); manager.finalizeCompetition(id, r, p, sig);
    }
    function testDuplicateWinners() public {
        uint256 id = _create(100 ether); _register(id, player);
        CM.Payout[] memory p = new CM.Payout[](2);
        p[0] = CM.Payout(player, 100, 1000, 60 ether); p[1] = CM.Payout(player, 90, 1000, 40 ether);
        CM.Result memory r = _result(id, p); bytes memory sig = _sign(r); vm.warp(1500);
        vm.expectRevert(CM.InvalidResult.selector); manager.finalizeCompetition(id, r, p, sig);
    }
    function testSignatureTamperReplayAndWrongChain() public {
        uint256 id = _create(100 ether); _register(id, player);
        CM.Payout[] memory p = new CM.Payout[](1); p[0] = CM.Payout(player, 100, 1000, 100 ether);
        CM.Result memory r = _result(id, p); bytes memory sig = _sign(r); vm.warp(1500);
        r.resultArtifactHash = keccak256("tampered");
        vm.expectRevert(CM.InvalidSignature.selector); manager.finalizeCompetition(id, r, p, sig);
        r.resultArtifactHash = keccak256("artifact"); vm.chainId(999);
        vm.expectRevert(CM.InvalidSignature.selector); manager.finalizeCompetition(id, r, p, sig);
        vm.chainId(31337); sig = _sign(r); manager.finalizeCompetition(id, r, p, sig);
        vm.expectRevert(CM.InvalidState.selector); manager.finalizeCompetition(id, r, p, sig);
    }
    function testCancellationAndBoundaryRefund() public {
        uint256 id = _create(100 ether);
        vm.prank(second); vm.expectRevert(CM.Unauthorized.selector); manager.cancelCompetition(id);
        vm.prank(creator); manager.cancelCompetition(id);
        require(manager.totalLiabilities() == 0);
        id = _create(100 ether); vm.warp(1100);
        vm.prank(creator); vm.expectRevert(CM.InvalidState.selector); manager.cancelCompetition(id);
        vm.prank(creator); vm.expectRevert(CM.InvalidState.selector); manager.refundExpiredCompetition(id);
        vm.warp(2000); vm.prank(creator); manager.refundExpiredCompetition(id);
        require(manager.totalLiabilities() == 0);
    }
    function testClaimFailureRetainsLiabilityAndOtherWinnerCanClaim() public {
        uint256 id = _create(100 ether); _register(id, player); _register(id, second);
        CM.Payout[] memory p = new CM.Payout[](2);
        p[0] = CM.Payout(player, 100, 1000, 60 ether); p[1] = CM.Payout(second, 90, 1000, 40 ether);
        CM.Result memory r = _result(id, p); bytes memory sig = _sign(r); vm.warp(1500); manager.finalizeCompetition(id, r, p, sig);
        token.blockRecipient(player); vm.expectRevert(); manager.claimFor(id, player);
        require(manager.claimable(id, player) == 60 ether && manager.totalLiabilities() == 100 ether);
        manager.claimFor(id, second); require(manager.totalLiabilities() == 60 ether);
        vm.warp(2000); vm.prank(creator); vm.expectRevert(CM.InvalidState.selector); manager.refundExpiredCompetition(id);
    }
    function testFeeTokenRejectedAtomically() public {
        token.enableFee(); vm.expectRevert(CM.UnsupportedTokenBehavior.selector); _create(100 ether);
        require(manager.competitionCount() == 0 && manager.totalLiabilities() == 0);
    }
    function testAuthoritiesSnapshotAndEscrowIsolation() public {
        uint256 first = _create(100 ether); uint256 other = _create(300 ether);
        manager.setAuthorities(second, second); require(manager.getCompetition(first).registrar == registrar);
        _register(first, player); _finalize(first, 100 ether); manager.claimFor(first, player);
        require(manager.totalLiabilities() == 300 ether && token.balanceOf(address(manager)) == 300 ether);
        vm.warp(2000); vm.prank(creator); manager.refundExpiredCompetition(other);
    }
    function testNoContestRefund() public {
        uint256 id = _create(100 ether);
        CM.NoContest memory r = CM.NoContest(id, keccak256("rules"), keccak256("artifact"), 0, 1999);
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(SIGNER_KEY, manager.noContestDigest(r));
        vm.warp(1500); manager.refundNoContest(id, r, abi.encodePacked(rr, s, v));
        require(manager.totalLiabilities() == 0 && manager.resultNonce(id) == 1);
    }
    function testFuzzExactAllocation(uint128 rawPool) public {
        uint256 pool = uint256(rawPool) % (1000 ether) + 1;
        uint256 id = _create(pool); _register(id, player); _finalize(id, pool); manager.claimFor(id, player);
        require(token.balanceOf(player) == pool && manager.totalLiabilities() == 0);
    }
}
