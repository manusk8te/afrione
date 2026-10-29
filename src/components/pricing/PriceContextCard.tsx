import SuppliesNotice from './SuppliesNotice'
export interface PriceContextView {
  status: string;
  version?: string;
  central_estimate_fcfa?: number | null;
  candidate_price_fcfa?: number | null;
  reason?: string;
  technical_match?: string;
  extrapolation?: boolean;
  quantity?: number;
  unit?: string;
  sources?: { id: string; country: string; url: string; source_scope?: string }[];
}

export default function PriceContextCard({ context, applied = false }: { context: PriceContextView; applied?: boolean }) {
  const central = context.central_estimate_fcfa;
  const candidate = context.candidate_price_fcfa;
  const hasEstimate = context.status === 'contextualisation_experimentale'
    && typeof central === 'number' && Number.isFinite(central) && central > 0
    && typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0;
  const amount = (value: number) => Math.round(value).toLocaleString('fr-FR');
  return (
    <section aria-label="Repère tarifaire contextualisé" style={{ background: '#FFF9F3', border: '1px solid #F0C8AE', borderRadius: '20px', padding: '22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '15px', color: 'var(--ui-ink)', fontWeight: 700, margin: 0 }}>Repère de prix pour votre demande</h2>
        <span style={{ color: '#975326', background: '#FFF0DF', borderRadius: '20px', padding: '4px 9px', fontSize: '11px' }}>À confirmer par un prestataire</span>
      </div>
      {hasEstimate ? (
        <>
          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', margin: '20px 0 12px' }}>
            <div>
              <dt style={{ color: '#697586', fontSize: '12px' }}>Référence adaptée à la Côte d’Ivoire</dt>
              <dd style={{ margin: '5px 0 0', color: 'var(--ui-ink)', fontSize: '21px', fontWeight: 600 }}>{amount(central!)} FCFA</dd>
            </div>
            <div>
              <dt style={{ color: '#697586', fontSize: '12px' }}>Proposition indicative issue de l’étude</dt>
              <dd style={{ margin: '5px 0 0', color: '#C95024', fontSize: '27px', fontWeight: 700 }}>{amount(candidate!)} FCFA</dd>
            </div>
          </dl>
          <p style={{ color: '#6B5A4F', fontSize: '12px', lineHeight: 1.65, margin: 0 }}>{applied ? 'Ce résultat constitue le prix indicatif proposé ci-dessous. Fournitures et frais à confirmer ; aucune ventilation ni addition automatique.' : 'Ce repère porte sur la prestation. Les fournitures et le contenu exact doivent être confirmés avant un devis ; ce montant n’est pas automatiquement ajouté au calcul ci-dessous.'}</p>
        </>
      ) : (
        <p style={{ color: '#6B5A4F', fontSize: '13px', lineHeight: 1.65, margin: '16px 0 0' }}>Les références disponibles ne suffisent pas encore à chiffrer cette demande dans le contexte ivoirien. Un prestataire doit confirmer le prix.</p>
      )}
      <SuppliesNotice sources={context.sources} />
      <details style={{ marginTop: '16px', color: '#6B5A4F', fontSize: '12px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>D’où vient ce repère ?</summary>
        {context.technical_match && <p>Comparaison : {context.technical_match}</p>}
        {context.quantity && <p>Périmètre : {context.quantity} {context.unit}. {context.extrapolation ? 'Extrapolation non validée localement.' : 'Calibration locale limitée.'}</p>}
        <p style={{ lineHeight: 1.65 }}>Des tarifs publiés en France et au Sénégal sont rapprochés d’une petite enquête ivoirienne. La correction est calculée à partir de ces données. Elle ne garantit pas un prix inférieur au marché réel ni un devis final.</p>
        {!!context.sources?.length && (
          <ul style={{ paddingLeft: '20px', marginBottom: 0 }}>
            {context.sources.map(source => (
              <li key={source.id} style={{ marginTop: '7px' }}>
                <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: '#9A4B24', textDecoration: 'underline' }}>
                  Voir la référence {source.country === 'FRA' ? 'française' : 'sénégalaise'}
                </a>
                {source.source_scope && <span> — {source.source_scope}</span>}
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}
