import Journal from '@/components/journal';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Journal postId={id}/>}
