import { notFound } from 'next/navigation';
import { isAddress } from 'viem';
import { Profile } from '@/components/profile';
export default async function Page({params}:{params:Promise<{wallet:string}>}){const{wallet}=await params;if(!isAddress(wallet))notFound();return <Profile wallet={wallet}/>;}
