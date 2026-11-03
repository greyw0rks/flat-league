import Link from 'next/link';
import { PublicHeader } from '@/components/layout';
export default function NotFound(){return <><PublicHeader/><main className="error-page" id="main"><h1>This round isn't here.</h1><p>The link may be incomplete, or the competition hasn't been published.</p><Link className="button primary" href="/discover">Back to the arena</Link></main></>;}
