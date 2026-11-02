import {authorize,errorResponse} from '@/lib/server';
import {getRecord,getOriginal} from '@/lib/repository';
export const runtime='nodejs';
export async function GET(request,{params}) {
  const denied=await authorize(request);if(denied)return denied;
  try {
    const {id}=await params;
    if(!/^[a-f0-9]{24}$/.test(id))return Response.json({error:'Invalid document ID.'},{status:400});
    const doc=await getRecord('documents',id);
    if(!doc?.hasOriginal)return Response.json({error:'No original PDF is stored for this document.'},{status:404});
    const buffer=await getOriginal(id);
    if(!buffer)return Response.json({error:'Original PDF not found.'},{status:404});
    return new Response(new Uint8Array(buffer),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${doc.ticker}-${doc.id}.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch(error){return errorResponse(error);}
}
