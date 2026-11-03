import { notFound } from 'next/navigation';
import { getCompetition } from '@/server/league';
import { CompetitionDetail } from '@/components/competition-detail';
import { AppError } from '@/server/errors';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){const{id}=await params;try{return <CompetitionDetail id={id} initial={await getCompetition(id)}/>;}catch(e){if(e instanceof AppError&&e.status===404)notFound();throw e;}}
