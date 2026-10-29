import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
// Un prix transmis par le navigateur ne devient jamais le prix payable.
export async function POST() {
 return NextResponse.json({ok:false,error:'Recalculez le devis avec l’agent AfriOne ; son prix est enregistré côté serveur.'},{status:409})
}
