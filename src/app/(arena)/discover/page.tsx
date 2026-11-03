import { Discover } from '@/components/discover';
import { listCompetitions } from '@/server/league';
export const dynamic='force-dynamic';
export const metadata={title:'Discover'};
export default async function Page(){return <Discover initial={await listCompetitions()}/>;}
