import { QuizRoom } from '@/components/quiz';
export const metadata={title:'Knowledge Run'};
export default async function Page({params}:{params:Promise<{id:string}>}){const{id}=await params;return <QuizRoom id={id}/>;}
