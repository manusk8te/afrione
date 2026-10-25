"""Importer les résultats existants sans réestimer ni modifier leurs coefficients."""
from pathlib import Path
import hashlib,json,shutil,sys
app=Path(__file__).resolve().parents[1]
study=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else app.parent
out=app/'src/data/pricing-studies'; runtime=app/'src/lib/pricing-studies';out.mkdir(parents=True,exist_ok=True)
files={
 'local-v2.json':'outputs/afrione_estimateur.json',
 'transfer-v3.json':'outputs/AfriOne_Transfert_Quantile_Modele.json',
 'context-v4.json':'outputs/AfriOne_Contextualisation_V4_Modele.json',
}
manifest=[]
for dest,source in files.items():
 p=study/source;shutil.copyfile(p,out/dest)
 manifest.append({'file':dest,'original':source,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
p=study/'outputs/afrione_estimateur.mjs';shutil.copyfile(p,runtime/'local-v2.mjs')
manifest.append({'file':'../../lib/pricing-studies/local-v2.mjs','original':'outputs/afrione_estimateur.mjs','sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
q=json.loads((study/'work/transfer-v3/quantile-resultats.json').read_text())
s=json.loads((study/'work/france-prix/selection-resultats.json').read_text())
e=json.loads((study/'work/france-prix/econometrie-resultats.json').read_text())
ranges={}
for row in q['mapped_rows']:
 a=ranges.setdefault(row['mission'],{'hours':[],'prices':[]});a['hours'].append(row['heures']);a['prices'].append(row['prix_fcfa'])
for mission,a in ranges.items():
 a.update(min_hours=min(a['hours']),max_hours=max(a['hours']),quantile_20_fcfa=sorted(a['prices'])[0]+(.2*(len(a['prices'])-1))*(sorted(a['prices'])[1]-sorted(a['prices'])[0]))
 # NumPy interpolation linéaire : ici toutes les missions ont 2 ou 3 réponses.
 assert len(a['prices']) in [2,3]
 a['n']=len(a['prices']);del a['hours'];del a['prices']
context={'schema_version':1,'version':'studies-import-2026-10-25','production_enabled':False,
 'scope':'mixed_or_unknown','manifest':manifest,'quantile_domain':ranges,
 'validation_groups':[
 {'id':'ci24-v2','n':24,'providers':6,'objective':'MAE FCFA','scores':s['scores'],'final_regression_config':s['final_config'],'diagnostic_tests':s['tests'],'note':'Les procédures Ridge et Lasso sont conservées comme comparaisons ; leurs modèles finaux ne sont pas exportés dans cette étude.'},
 {'id':'ci14-v3','n':14,'providers':6,'objective':'Perte quantile normalisée, q=0.2','scores':q['scores'],'floor_scenarios':q['floor_scores'],'note':'Ne pas comparer directement les scores aux 24 réponses de V2.'}],
 'earlier_econometric_diagnostics':{'models':e['models'],'tests':e['tests'],'scores':e['scores']},
 'hypotheses':q['hypotheses'],
 'notes':['Aucun réentraînement pendant un devis.','Les trois artefacts du manifeste sont copiés octet pour octet.','Les modèles actuels ne séparent pas proprement main-d’œuvre et fournitures.']}
(out/'context.json').write_text(json.dumps(context,ensure_ascii=False,indent=2,allow_nan=False))
print('Import sans réentraînement :',len(manifest),'artefacts ;',len(ranges),'missions de transfert.')
