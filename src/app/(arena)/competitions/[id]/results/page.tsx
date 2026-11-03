import { CompetitionResults } from '@/components/results';
export const metadata={title:'Competition results'};
export default async function Page({params}:{params:Promise<{id:string}>}){const{id}=await params;return <CompetitionResults id={id}/>;}
