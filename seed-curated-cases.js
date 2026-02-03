const { v4: uuidv4 } = require('uuid');
const db = require('./models/database');

// Clear existing data
console.log('Clearing existing cases...');
db.exec('DELETE FROM case_tags');
db.exec('DELETE FROM quiz_attempts');
db.exec('DELETE FROM user_case_progress');
db.exec('DELETE FROM dicom_series');
db.exec('DELETE FROM images');
db.exec('DELETE FROM cases');
db.exec('DELETE FROM tags');

// Create tags
const tagNames = [
  'Emergency', 'Pediatric', 'Oncology', 'Trauma', 'Infection',
  'Vascular', 'Degenerative', 'Congenital', 'Inflammatory', 'Classic',
  'Must-Know', 'Boards Favorite', 'Subtle Finding', 'Life-Threatening'
];

const tagMap = {};
const insertTag = db.prepare('INSERT INTO tags (name) VALUES (?)');
for (const name of tagNames) {
  const result = insertTag.run(name);
  tagMap[name] = result.lastInsertRowid;
}

// Insert case helper
const insertCase = db.prepare(`
  INSERT INTO cases (id, title, modality, body_part, diagnosis, difficulty, clinical_history, teaching_points, findings)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertCaseTag = db.prepare('INSERT INTO case_tags (case_id, tag_id) VALUES (?, ?)');

function addCase(caseData, tags) {
  const id = uuidv4();
  insertCase.run(
    id,
    caseData.title,
    caseData.modality,
    caseData.body_part,
    caseData.diagnosis,
    caseData.difficulty,
    caseData.clinical_history,
    caseData.teaching_points,
    caseData.findings
  );
  for (const tag of tags) {
    if (tagMap[tag]) {
      insertCaseTag.run(id, tagMap[tag]);
    }
  }
  console.log(`  Added: ${caseData.title}`);
  return id;
}

console.log('\nAdding curated teaching cases...\n');

// ============ CHEST CT ============
addCase({
  title: 'Saddle Pulmonary Embolism',
  modality: 'CT',
  body_part: 'Chest',
  diagnosis: 'Saddle Pulmonary Embolism',
  difficulty: 2,
  clinical_history: '58-year-old male with sudden onset dyspnea and pleuritic chest pain. Recent long-haul flight. D-dimer elevated.',
  teaching_points: `• Saddle PE straddles the main pulmonary artery bifurcation
• Look for RV strain: RV/LV ratio >1, septal bowing, reflux of contrast into IVC/hepatic veins
• Check for peripheral emboli in segmental/subsegmental arteries
• Evaluate for pulmonary infarcts (peripheral wedge-shaped opacities)
• McConnell's sign on echo: RV free wall akinesis with apical sparing`,
  findings: `Large filling defect at the bifurcation of the main pulmonary artery extending into both right and left main pulmonary arteries (saddle embolus). Additional filling defects in bilateral lobar and segmental pulmonary arteries. Right ventricle is dilated with RV/LV ratio of 1.3, consistent with right heart strain. Contrast reflux into the IVC and hepatic veins. No pulmonary infarct identified.`
}, ['Emergency', 'Life-Threatening', 'Vascular', 'Must-Know', 'Boards Favorite']);

addCase({
  title: 'Tension Pneumothorax',
  modality: 'XR',
  body_part: 'Chest',
  diagnosis: 'Tension Pneumothorax',
  difficulty: 1,
  clinical_history: '24-year-old male status post motorcycle accident with severe respiratory distress, hypotension, and absent breath sounds on the right.',
  teaching_points: `• Complete lung collapse with mediastinal shift AWAY from affected side
• Depression of ipsilateral hemidiaphragm
• Widening of intercostal spaces on affected side
• Clinical diagnosis - do NOT wait for imaging in unstable patient
• Immediate needle decompression followed by chest tube placement
• Can occur spontaneously in tall, thin males (primary) or with underlying lung disease (secondary)`,
  findings: `Complete collapse of the right lung with large right pneumothorax. Marked leftward shift of the mediastinum and trachea. Depression of the right hemidiaphragm. Widening of the right intercostal spaces. No rib fractures identified. Findings consistent with tension pneumothorax requiring emergent decompression.`
}, ['Emergency', 'Trauma', 'Life-Threatening', 'Must-Know']);

addCase({
  title: 'Miliary Tuberculosis',
  modality: 'CT',
  body_part: 'Chest',
  diagnosis: 'Miliary Tuberculosis',
  difficulty: 3,
  clinical_history: '34-year-old immunocompromised male with fever, night sweats, weight loss, and progressive dyspnea over 3 weeks. Recent immigrant from endemic region.',
  teaching_points: `• Innumerable 1-3mm nodules uniformly distributed throughout both lungs
• "Millet seed" appearance - random distribution unlike other nodular patterns
• Hematogenous dissemination - check for extrapulmonary involvement
• Differential: fungal infection, metastatic thyroid/renal cancer, sarcoidosis
• Associated findings: lymphadenopathy, pleural effusion, pericardial effusion
• High mortality if untreated - requires prompt initiation of anti-TB therapy`,
  findings: `Innumerable 1-3mm pulmonary nodules distributed uniformly and randomly throughout both lungs in a miliary pattern. Subcarinal and right hilar lymphadenopathy with central low attenuation suggesting necrosis. Small bilateral pleural effusions. Hepatosplenomegaly with multiple small hypodense splenic lesions suggesting disseminated infection.`
}, ['Infection', 'Classic', 'Must-Know']);

addCase({
  title: 'Pancoast Tumor',
  modality: 'CT',
  body_part: 'Chest',
  diagnosis: 'Superior Sulcus (Pancoast) Tumor',
  difficulty: 3,
  clinical_history: '62-year-old male smoker with right shoulder pain radiating down the arm, hand weakness, and ptosis of the right eye for 2 months.',
  teaching_points: `• Apical lung mass with chest wall invasion
• Pancoast syndrome: shoulder/arm pain from brachial plexus invasion (C8-T2)
• Horner syndrome: ptosis, miosis, anhidrosis from sympathetic chain invasion
• Look for: rib destruction, vertebral body invasion, subclavian vessel involvement
• Most are non-small cell lung cancer (squamous or adenocarcinoma)
• Staging MRI helpful for brachial plexus and spinal canal assessment`,
  findings: `5.2 cm mass in the right lung apex extending into the superior sulcus. Erosion and destruction of the posterior aspects of the right 1st and 2nd ribs. Tumor encases the right subclavian artery without significant narrowing. Extension into the right neural foramen at T1 with possible involvement of the lower brachial plexus. Ipsilateral mediastinal lymphadenopathy.`
}, ['Oncology', 'Classic', 'Boards Favorite']);

addCase({
  title: 'Aortic Dissection (Type A)',
  modality: 'CT',
  body_part: 'Chest',
  diagnosis: 'Stanford Type A Aortic Dissection',
  difficulty: 2,
  clinical_history: '67-year-old male with hypertension presenting with sudden severe "tearing" chest pain radiating to the back. Blood pressure differential between arms.',
  teaching_points: `• Intimal flap separating true and false lumens
• Type A involves ascending aorta (surgical emergency)
• Type B involves descending aorta only (usually medical management)
• True lumen: typically smaller, continues with undissected vessel
• False lumen: often larger, may have slow flow ("smoke"), cobwebs
• Complications: rupture, malperfusion (coronary, cerebral, mesenteric, renal), aortic regurgitation, tamponade`,
  findings: `Intimal flap identified extending from the aortic root through the ascending aorta, aortic arch, and into the proximal descending thoracic aorta (DeBakey Type I). The true lumen is compressed and smaller, located anteriorly. The false lumen demonstrates slower contrast opacification. No pericardial effusion. Branch vessels arise from the true lumen. Celiac, SMA, and bilateral renal arteries appear patent.`
}, ['Emergency', 'Vascular', 'Life-Threatening', 'Must-Know', 'Classic']);

// ============ NEURORADIOLOGY ============
addCase({
  title: 'Acute Epidural Hematoma',
  modality: 'CT',
  body_part: 'Head',
  diagnosis: 'Acute Epidural Hematoma',
  difficulty: 2,
  clinical_history: '19-year-old male found unresponsive after being struck by a baseball. Brief loss of consciousness with subsequent lucid interval, now deteriorating.',
  teaching_points: `• Biconvex (lens-shaped) hyperdense collection that does NOT cross suture lines
• Usually arterial - middle meningeal artery laceration from temporal bone fracture
• "Lucid interval" - patient may appear fine initially before rapid deterioration
• Associated with overlying skull fracture in 85-95% of cases
• Surgical emergency if significant mass effect or neurologic decline
• Contrast with subdural hematoma: crescent-shaped, crosses sutures, venous origin`,
  findings: `Biconvex hyperdense extra-axial collection in the right temporal region measuring 2.1 cm in maximal thickness, consistent with acute epidural hematoma. The collection does not cross the coronal suture. Associated non-displaced fracture of the right temporal bone. Effacement of the right lateral ventricle and 8mm leftward midline shift. Uncal herniation with effacement of the right suprasellar cistern.`
}, ['Emergency', 'Trauma', 'Life-Threatening', 'Must-Know', 'Classic']);

addCase({
  title: 'Acute Subdural Hematoma',
  modality: 'CT',
  body_part: 'Head',
  diagnosis: 'Acute Subdural Hematoma',
  difficulty: 2,
  clinical_history: '78-year-old female on anticoagulation found on the floor after a fall. GCS 10, left-sided weakness.',
  teaching_points: `• Crescent-shaped hyperdense collection that CROSSES suture lines
• Venous origin - bridging vein rupture between cortex and dural sinuses
• Common in elderly (brain atrophy stretches bridging veins) and anticoagulated patients
• Density changes with age: acute (hyperdense) → subacute (isodense) → chronic (hypodense)
• "Swirl sign" - areas of hypodensity within acute SDH suggests active bleeding
• Evaluate for: midline shift, herniation, underlying contusion`,
  findings: `Crescentic hyperdense extra-axial collection along the right cerebral convexity measuring up to 1.8 cm in thickness, extending from the frontal to occipital region and crossing multiple suture lines, consistent with acute subdural hematoma. Heterogeneous areas of hypodensity within the collection (swirl sign) suggesting active hemorrhage. Rightward subfalcine herniation with 12mm leftward midline shift. Effacement of the right lateral ventricle.`
}, ['Emergency', 'Trauma', 'Life-Threatening', 'Must-Know', 'Classic']);

addCase({
  title: 'MCA Territory Acute Infarct',
  modality: 'CT',
  body_part: 'Head',
  diagnosis: 'Acute Middle Cerebral Artery Infarction',
  difficulty: 2,
  clinical_history: '72-year-old male with atrial fibrillation presenting with sudden onset right-sided weakness and aphasia. Symptom onset 2 hours ago.',
  teaching_points: `• Early CT signs (within 6 hours): hyperdense MCA sign, insular ribbon sign, loss of gray-white differentiation, sulcal effacement
• MCA supplies: lateral frontal/parietal/temporal lobes, insula, basal ganglia
• Dominant hemisphere (usually left): Broca aphasia (frontal), Wernicke aphasia (temporal)
• ASPECTS score: 10-point scale assessing MCA territory involvement
• CTA for vessel occlusion - "target mismatch" for thrombectomy eligibility
• Time is brain: 1.9 million neurons lost per minute of ischemia`,
  findings: `Loss of gray-white matter differentiation in the left insular cortex (insular ribbon sign) and left lentiform nucleus. Subtle hypodensity and sulcal effacement in the left frontal and parietal opercula. Hyperdense left M1 segment of the middle cerebral artery. ASPECTS score of 7. No hemorrhagic transformation. CTA (if performed) would be recommended to assess for large vessel occlusion amenable to mechanical thrombectomy.`
}, ['Emergency', 'Vascular', 'Life-Threatening', 'Must-Know', 'Boards Favorite']);

addCase({
  title: 'Ruptured Cerebral Aneurysm with SAH',
  modality: 'CT',
  body_part: 'Head',
  diagnosis: 'Subarachnoid Hemorrhage from Ruptured Aneurysm',
  difficulty: 2,
  clinical_history: '52-year-old female with sudden onset "worst headache of my life" followed by brief loss of consciousness. Neck stiffness on examination.',
  teaching_points: `• High-density blood in subarachnoid spaces: basal cisterns, sylvian fissures, sulci
• Modified Fisher scale predicts vasospasm risk
• Most common locations: AComm (30%), PComm (25%), MCA bifurcation (20%)
• CTA for aneurysm detection - look at circle of Willis carefully
• Complications: rebleeding, vasospasm (days 4-14), hydrocephalus, hyponatremia
• Sentinel headache: warning leak may precede major rupture`,
  findings: `Diffuse high-density material within the subarachnoid space, most prominent in the suprasellar cistern, bilateral sylvian fissures, and interhemispheric fissure, consistent with acute subarachnoid hemorrhage. Blood extends into the left sylvian fissure more than the right. Mild hydrocephalus with temporal horn dilation. CTA demonstrates a 7mm saccular aneurysm arising from the left internal carotid artery at the origin of the posterior communicating artery.`
}, ['Emergency', 'Vascular', 'Life-Threatening', 'Must-Know', 'Classic']);

addCase({
  title: 'Glioblastoma Multiforme',
  modality: 'MRI',
  body_part: 'Head',
  diagnosis: 'Glioblastoma Multiforme (GBM)',
  difficulty: 3,
  clinical_history: '58-year-old male with progressive headaches, left-sided weakness, and personality changes over 6 weeks.',
  teaching_points: `• Irregular heterogeneous mass with central necrosis and thick irregular enhancing rim
• Surrounding vasogenic edema - "finger-like" projecting into white matter
• Crosses corpus callosum ("butterfly glioma") - pathognomonic for high-grade glioma
• WHO Grade IV - most aggressive primary brain tumor
• T2/FLAIR hyperintense, restricted diffusion at cellular margins
• GBM can be multifocal; dissemination via CSF pathways possible`,
  findings: `Large heterogeneous mass centered in the right frontal lobe measuring 5.8 x 4.2 x 4.5 cm. The mass demonstrates thick irregular peripheral enhancement with central non-enhancing necrosis. Extension across the genu of the corpus callosum into the left frontal lobe. Extensive surrounding T2/FLAIR hyperintense vasogenic edema. Mass effect with effacement of the right frontal horn and 8mm leftward midline shift. No restricted diffusion to suggest acute infarct; however, elevated perfusion at the enhancing margins.`
}, ['Oncology', 'Classic', 'Must-Know']);

addCase({
  title: 'Vestibular Schwannoma (Acoustic Neuroma)',
  modality: 'MRI',
  body_part: 'Head',
  diagnosis: 'Vestibular Schwannoma',
  difficulty: 3,
  clinical_history: '45-year-old female with progressive right-sided hearing loss, tinnitus, and imbalance for 1 year.',
  teaching_points: `• Enhancing mass at the cerebellopontine angle with extension into internal auditory canal
• "Ice cream on cone" appearance - larger CPA component with IAC extension
• Arises from vestibular portion of CN VIII (not acoustic/cochlear)
• Bilateral schwannomas = Neurofibromatosis Type 2 (NF2)
• Differential: meningioma (dural tail, calcification), epidermoid (restricted diffusion)
• Can cause widening/erosion of the IAC`,
  findings: `Well-circumscribed enhancing mass at the right cerebellopontine angle measuring 2.4 x 2.1 cm with extension into the right internal auditory canal. The mass demonstrates avid homogeneous enhancement. The intracanalicular component expands and fills the IAC. Mass effect on the right middle cerebellar peduncle and pons. The right facial nerve is displaced anteriorly. T2-weighted images show the mass to be isointense to brain. No restricted diffusion.`
}, ['Classic', 'Boards Favorite']);

// ============ ABDOMINAL ============
addCase({
  title: 'Acute Appendicitis',
  modality: 'CT',
  body_part: 'Abdomen',
  diagnosis: 'Acute Appendicitis',
  difficulty: 1,
  clinical_history: '28-year-old male with 24 hours of periumbilical pain migrating to the right lower quadrant, fever, and anorexia.',
  teaching_points: `• Dilated appendix >6mm with wall thickening and enhancement
• Periappendiceal fat stranding - most sensitive CT finding
• Appendicolith present in ~25% of cases
• Complications: perforation, abscess, phlegmon
• Tip of appendix can be retrocecal, pelvic, or subhepatic
• Secondary signs: focal cecal thickening, local ileus, free fluid`,
  findings: `The appendix is dilated to 12mm in diameter with wall thickening and hyperenhancement. A 5mm calcified appendicolith is present at the base of the appendix. Extensive periappendiceal fat stranding and a small amount of free fluid in the right lower quadrant. Focal wall thickening of the cecal tip (cecal bar sign). No evidence of perforation or abscess formation. Findings consistent with acute uncomplicated appendicitis.`
}, ['Emergency', 'Infection', 'Inflammatory', 'Must-Know', 'Classic']);

addCase({
  title: 'Small Bowel Obstruction with Transition Point',
  modality: 'CT',
  body_part: 'Abdomen',
  diagnosis: 'Adhesive Small Bowel Obstruction',
  difficulty: 2,
  clinical_history: '65-year-old female with prior abdominal surgeries presenting with crampy abdominal pain, vomiting, and obstipation for 2 days.',
  teaching_points: `• Dilated small bowel (>3cm) proximal to transition point, decompressed distally
• "Small bowel feces sign" - particulate matter in dilated bowel suggests prolonged obstruction
• Adhesions are most common cause in developed countries (previous surgery)
• Look for: closed loop (C or U shaped), mesenteric swirl (volvulus), lack of enhancement (ischemia)
• "String of pearls" sign on upright XR: trapped air in bowel loops
• Strangulation signs: bowel wall thickening, reduced enhancement, mesenteric haziness`,
  findings: `Multiple dilated loops of small bowel measuring up to 4.5 cm in diameter with air-fluid levels. Transition point identified in the right lower quadrant where bowel abruptly changes caliber from dilated to decompressed. No discrete mass, hernia, or intraluminal lesion at the transition point suggesting adhesive obstruction. Small bowel feces sign present. The colon is decompressed. No evidence of closed loop obstruction. Bowel wall enhances normally without thickening or pneumatosis. No free air or free fluid.`
}, ['Emergency', 'Must-Know']);

addCase({
  title: 'Hepatocellular Carcinoma',
  modality: 'CT',
  body_part: 'Abdomen',
  diagnosis: 'Hepatocellular Carcinoma (HCC)',
  difficulty: 3,
  clinical_history: '62-year-old male with hepatitis C cirrhosis presenting with rising AFP levels and weight loss. Surveillance ultrasound showed a new liver mass.',
  teaching_points: `• Classic enhancement pattern: arterial hyperenhancement + washout on portal venous/delayed phases
• LI-RADS system for standardized reporting in at-risk patients
• Ancillary features: capsule appearance, mosaic architecture, fat/iron sparing
• Tumor in vein (portal/hepatic) = pathognomonic for HCC (LI-RADS 5V)
• Differential in cirrhosis: regenerative nodule (no washout), dysplastic nodule, cholangiocarcinoma
• Barcelona Clinic Liver Cancer (BCLC) staging guides treatment`,
  findings: `4.2 cm mass in hepatic segment VI demonstrating arterial phase hyperenhancement with washout on portal venous and delayed phases. Enhancing capsule appearance on delayed phase. Background liver is nodular with surface irregularity consistent with cirrhosis. Splenomegaly (15 cm) and small volume ascites. Patent portal and hepatic veins without tumor thrombus. No lymphadenopathy. LI-RADS category 5 (definitely HCC).`
}, ['Oncology', 'Classic', 'Boards Favorite']);

addCase({
  title: 'Ruptured Abdominal Aortic Aneurysm',
  modality: 'CT',
  body_part: 'Abdomen',
  diagnosis: 'Ruptured Abdominal Aortic Aneurysm',
  difficulty: 2,
  clinical_history: '75-year-old male with known AAA presenting with sudden severe back pain, hypotension, and pulsatile abdominal mass.',
  teaching_points: `• Aneurysm >3cm with retroperitoneal hematoma (high attenuation on non-contrast)
• "Draped aorta" sign: posterior wall conforms to vertebral body (impending rupture)
• "Crescent sign" on non-contrast: high-attenuation blood in mural thrombus (impending rupture)
• "Tangential calcium" sign: focal discontinuity of calcified wall
• Contained rupture into retroperitoneum may allow time for repair
• Unstable patients may go directly to OR without imaging`,
  findings: `Infrarenal abdominal aortic aneurysm measuring 7.8 cm in maximal diameter with extensive mural thrombus. Focal discontinuity of the posterior wall with active contrast extravasation into the left retroperitoneum. Large retroperitoneal hematoma extending from the left renal hilum to the pelvis, displacing the left kidney anteriorly. High-attenuation acute blood tracks along the left psoas muscle. Findings consistent with ruptured AAA requiring emergent surgical repair.`
}, ['Emergency', 'Vascular', 'Life-Threatening', 'Must-Know', 'Classic']);

addCase({
  title: 'Acute Pancreatitis with Necrosis',
  modality: 'CT',
  body_part: 'Abdomen',
  diagnosis: 'Acute Necrotizing Pancreatitis',
  difficulty: 3,
  clinical_history: '48-year-old male with history of alcohol abuse presenting with severe epigastric pain radiating to the back, nausea, vomiting. Lipase >3x normal.',
  teaching_points: `• Diffuse pancreatic enlargement with peripancreatic fat stranding (edematous type)
• Necrosis: non-enhancing areas of pancreatic parenchyma (>30% = severe)
• Balthazar/CT Severity Index predicts morbidity and mortality
• Complications: pseudocyst (>4 weeks), walled-off necrosis, pseudoaneurysm, splenic vein thrombosis
• Acute peripancreatic fluid collections evolve over time
• Infection of necrosis (gas bubbles, clinical deterioration) requires drainage`,
  findings: `Diffuse enlargement of the pancreas with extensive peripancreatic and retroperitoneal fat stranding. Large geographic areas of non-enhancement involving approximately 50% of the pancreatic body and tail consistent with parenchymal necrosis. Acute necrotic collection in the lesser sac extending along the left anterior pararenal space measuring 12 x 8 x 15 cm. No gas bubbles to suggest infection. Thickening of Gerota's fascia bilaterally. Small bilateral pleural effusions, greater on the left. CT Severity Index of 8 (severe).`
}, ['Emergency', 'Inflammatory', 'Must-Know']);

addCase({
  title: 'Sigmoid Volvulus',
  modality: 'CT',
  body_part: 'Abdomen',
  diagnosis: 'Sigmoid Volvulus',
  difficulty: 2,
  clinical_history: '82-year-old nursing home resident with chronic constipation presenting with abdominal distension, obstipation, and crampy pain for 2 days.',
  teaching_points: `• Massively dilated sigmoid colon with "coffee bean" or "bent inner tube" appearance
• "Whirl sign" at the twist point: mesentery and vessels twist around each other
• "Bird beak" or "Ace of Spades" sign: tapered ends pointing to the twist
• Risk factors: elderly, institutionalized, neuropsychiatric conditions, high-fiber diet
• First-line treatment: endoscopic decompression if no peritonitis/ischemia
• Differentiate from cecal volvulus (comma-shaped cecum in LUQ, ileocecal valve points to RLQ)`,
  findings: `Massively dilated sigmoid colon forming an inverted U-shape extending from the pelvis to the upper abdomen, measuring up to 15 cm in diameter. The two limbs of the dilated sigmoid arise from a single point in the pelvis where a "whirl sign" is identified, indicating mesenteric torsion. "Bird beak" configuration at the point of twist. Transition to decompressed rectum. Dilated small bowel loops suggesting upstream obstruction. The sigmoid wall enhances normally without pneumatosis or perforation.`
}, ['Emergency', 'Classic', 'Must-Know', 'Boards Favorite']);

// ============ MUSCULOSKELETAL ============
addCase({
  title: 'Hip Fracture (Femoral Neck)',
  modality: 'XR',
  body_part: 'Hip',
  diagnosis: 'Displaced Femoral Neck Fracture',
  difficulty: 1,
  clinical_history: '78-year-old female with osteoporosis who fell at home. Unable to bear weight, shortened and externally rotated right leg.',
  teaching_points: `• Garden classification: I (incomplete/valgus impacted), II (complete non-displaced), III (complete partially displaced), IV (complete fully displaced)
• Disruption of Shenton line (arc from femoral neck to obturator foramen)
• Blood supply to femoral head from medial circumflex femoral artery - at risk with displacement
• Avascular necrosis risk increases with displacement and delay to surgery
• If radiograph negative but high clinical suspicion → MRI to detect occult fracture
• Treatment: hemiarthroplasty or THA for displaced fractures in elderly`,
  findings: `Complete fracture through the right femoral neck with varus angulation and posterior displacement of the femoral head relative to the shaft. The fracture is subcapital in location. Disruption of Shenton's line on the right. External rotation of the distal fragment with shortening. Diffuse osteopenia. Garden classification IV. The acetabulum is intact.`
}, ['Trauma', 'Emergency', 'Must-Know', 'Classic']);

addCase({
  title: 'Anterior Shoulder Dislocation',
  modality: 'XR',
  body_part: 'Shoulder',
  diagnosis: 'Anterior Glenohumeral Dislocation with Hill-Sachs Deformity',
  difficulty: 2,
  clinical_history: '22-year-old male athlete who fell on an outstretched arm during football. Severe shoulder pain with arm held in abduction and external rotation.',
  teaching_points: `• Humeral head displaced anteriorly and inferiorly relative to glenoid
• Hill-Sachs lesion: compression fracture of posterosuperior humeral head from impaction against anterior glenoid
• Bankart lesion: avulsion of anterior-inferior glenoid labrum (MRI/MRA for soft tissue Bankart)
• Associated injuries: greater tuberosity fracture, rotator cuff tear
• Axillary nerve injury (deltoid weakness, lateral shoulder numbness)
• Recurrence rate high in young patients - often need surgical stabilization`,
  findings: `The right humeral head is displaced anteriorly and inferiorly, lying inferior to the coracoid process, consistent with anterior glenohumeral dislocation. The humeral head is not articulating with the glenoid fossa. There is a compression deformity of the posterolateral aspect of the humeral head (Hill-Sachs deformity). No obvious fracture of the glenoid rim on radiograph, though CT or MRI would better evaluate for bony Bankart lesion. No associated greater tuberosity fracture.`
}, ['Trauma', 'Emergency', 'Classic', 'Must-Know']);

addCase({
  title: 'Osteosarcoma of Distal Femur',
  modality: 'XR',
  body_part: 'Knee',
  diagnosis: 'Osteosarcoma',
  difficulty: 3,
  clinical_history: '14-year-old male with progressive knee pain and swelling for 2 months, worse at night. Palpable firm mass above the knee.',
  teaching_points: `• Aggressive bone lesion with mixed lytic/scite changes, permeative margins
• Periosteal reaction: "sunburst" (spiculated perpendicular) or Codman triangle (lifted periosteum)
• Most common primary malignant bone tumor in children/adolescents
• Typical location: metaphysis of long bones around knee (distal femur > proximal tibia)
• Associated with rapid bone growth, prior radiation, Paget disease, retinoblastoma gene mutation
• MRI for marrow extent and skip lesions; chest CT for pulmonary metastases`,
  findings: `Aggressive mixed lytic and sclerotic lesion in the distal femoral metaphysis with permeative pattern of bone destruction. Extensive periosteal reaction with "sunburst" appearance and Codman triangle along the anterior cortex. Large associated soft tissue mass extending into the surrounding musculature. No pathologic fracture. The lesion does not cross the physis. Appearances are consistent with osteosarcoma. MRI staging recommended.`
}, ['Oncology', 'Pediatric', 'Classic', 'Boards Favorite']);

addCase({
  title: 'Scaphoid Fracture',
  modality: 'XR',
  body_part: 'Wrist',
  diagnosis: 'Scaphoid Waist Fracture',
  difficulty: 2,
  clinical_history: '25-year-old female who fell on outstretched hand. Anatomic snuffbox tenderness and pain with axial loading of the thumb.',
  teaching_points: `• Most commonly fractured carpal bone (70% of carpal fractures)
• Waist fractures most common (70%), followed by proximal pole (20%), distal pole (10%)
• Initial radiographs negative in up to 20% of cases - high clinical suspicion warrants immobilization
• Blood supply enters distally → proximal pole at risk for AVN
• Delayed union/nonunion common due to poor blood supply and continued motion
• Follow-up imaging: repeat XR at 2 weeks, or immediate MRI if early diagnosis needed`,
  findings: `Subtle lucent fracture line through the waist of the scaphoid, perpendicular to the long axis of the bone, with minimal displacement (<1mm). No angulation of the fracture fragments. No sclerosis or fragmentation to suggest chronicity. The remaining carpal bones are intact with normal alignment. No radiocarpal joint effusion. Clinical correlation for occult fracture if initial films negative but high clinical suspicion.`
}, ['Trauma', 'Classic', 'Subtle Finding', 'Boards Favorite']);

// ============ PEDIATRIC ============
addCase({
  title: 'Hypertrophic Pyloric Stenosis',
  modality: 'US',
  body_part: 'Abdomen',
  diagnosis: 'Hypertrophic Pyloric Stenosis',
  difficulty: 2,
  clinical_history: '5-week-old male with progressive non-bilious projectile vomiting after feeds. "Hungry vomiter." Palpable olive-shaped mass in the right upper quadrant.',
  teaching_points: `• Pyloric muscle thickness >3mm and pyloric channel length >15mm
• "Target sign" on transverse view: hypoechoic thickened muscle around echogenic mucosa
• "Antral nipple" or "cervix sign": redundant pyloric mucosa protruding into antrum
• Typical presentation: 3-6 week old male (4:1 male predominance), firstborn
• Hypochloremic, hypokalemic metabolic alkalosis from vomiting gastric contents
• Treatment: pyloromyotomy (Ramstedt procedure) after electrolyte correction`,
  findings: `The pyloric muscle is abnormally thickened, measuring 5mm in thickness (normal <3mm). The pyloric channel is elongated, measuring 19mm in length (normal <15mm). Target sign present on transverse imaging. Failure of gastric content to pass through the pyloric channel during real-time observation. The antral nipple sign is present. Findings consistent with hypertrophic pyloric stenosis.`
}, ['Pediatric', 'Classic', 'Must-Know', 'Boards Favorite']);

addCase({
  title: 'Intussusception',
  modality: 'US',
  body_part: 'Abdomen',
  diagnosis: 'Ileocolic Intussusception',
  difficulty: 2,
  clinical_history: '18-month-old male with intermittent colicky abdominal pain, drawing up legs, and currant jelly stools. Episodes of lethargy between pain episodes.',
  teaching_points: `• "Target" or "doughnut" sign on transverse: concentric rings of bowel within bowel
• "Pseudokidney" sign on longitudinal: layers of intussusceptum within intussuscipiens
• Ileocolic most common (ileum telescopes into colon through ileocecal valve)
• Lead point rarely identified in children (more common >3 years) - Meckel, polyp, lymphoma
• Pneumatic or hydrostatic reduction success rate 80-95% if no perforation/peritonitis
• Contraindications to reduction: perforation, peritonitis, profound shock`,
  findings: `Intussusception identified in the right abdomen with the intussusceptum within the intussuscipiens. On transverse imaging, classic target/doughnut sign with multiple concentric rings representing bowel wall layers. On longitudinal imaging, pseudokidney appearance. The intussusception measures approximately 4cm in length. Color Doppler shows blood flow to the intussusceptum. Small amount of fluid within the intussusception but no free peritoneal fluid. No lead point mass identified. Findings consistent with ileocolic intussusception amenable to pneumatic/hydrostatic reduction.`
}, ['Pediatric', 'Emergency', 'Classic', 'Must-Know', 'Boards Favorite']);

addCase({
  title: 'Slipped Capital Femoral Epiphysis',
  modality: 'XR',
  body_part: 'Hip',
  diagnosis: 'Slipped Capital Femoral Epiphysis (SCFE)',
  difficulty: 2,
  clinical_history: '13-year-old obese male with 3 weeks of progressive right hip and knee pain. Limp and limited internal rotation of the hip.',
  teaching_points: `• Posterior and medial displacement of femoral epiphysis on metaphysis ("ice cream falling off cone")
• Klein's line: line along superior femoral neck should intersect lateral epiphysis - fails in SCFE
• Widening and irregularity of the physis
• Risk factors: obesity, male, age 10-16, endocrinopathies (hypothyroid, growth hormone)
• Always image BOTH hips - bilateral in 20-40%
• Stable vs unstable (ability to bear weight) - unstable has higher AVN risk`,
  findings: `The right femoral capital epiphysis is displaced posteriorly and medially relative to the femoral neck. Klein's line drawn along the superior aspect of the femoral neck fails to intersect the lateral portion of the epiphysis on the frog-leg lateral view. Widening and irregularity of the right proximal femoral physis. The left hip appears normal with Klein's line intersecting the lateral epiphysis appropriately. No evidence of avascular necrosis. Findings consistent with right-sided slipped capital femoral epiphysis.`
}, ['Pediatric', 'Classic', 'Must-Know', 'Boards Favorite']);

// ============ ADDITIONAL CLASSIC CASES ============
addCase({
  title: 'Renal Cell Carcinoma',
  modality: 'CT',
  body_part: 'Abdomen',
  diagnosis: 'Clear Cell Renal Cell Carcinoma',
  difficulty: 3,
  clinical_history: '58-year-old male with incidentally discovered renal mass on ultrasound. Mild flank pain and microscopic hematuria.',
  teaching_points: `• Solid enhancing renal mass (>20 HU enhancement) - RCC until proven otherwise
• Clear cell most common subtype - avidly enhancing, often heterogeneous
• Bosniak classification for cystic lesions (I-IV)
• Look for: renal vein/IVC tumor thrombus, adrenal involvement, lymphadenopathy
• von Hippel-Lindau: bilateral/multifocal RCC, hemangioblastomas, pheochromocytoma
• Staging determines surgical approach (partial vs radical nephrectomy)`,
  findings: `5.3 cm heterogeneous mass arising from the interpolar region of the left kidney, predominantly exophytic. The mass demonstrates avid enhancement on the corticomedullary phase (peak ~150 HU) with washout on the nephrographic phase, typical of clear cell renal cell carcinoma. Central areas of necrosis. The mass does not extend into the renal sinus fat or collecting system. Patent left renal vein and IVC without tumor thrombus. Normal right kidney. No regional lymphadenopathy. Normal adrenal glands.`
}, ['Oncology', 'Classic', 'Boards Favorite']);

addCase({
  title: 'Pneumoperitoneum from Perforated Viscus',
  modality: 'CT',
  body_part: 'Abdomen',
  diagnosis: 'Perforated Duodenal Ulcer with Pneumoperitoneum',
  difficulty: 2,
  clinical_history: '55-year-old male with history of NSAID use presenting with sudden severe epigastric pain now diffuse. Rigid abdomen on exam.',
  teaching_points: `• Free intraperitoneal air (pneumoperitoneum) on CT or upright chest XR
• Most common causes: perforated peptic ulcer, diverticulitis, appendicitis, trauma, post-surgical
• Air rises to non-dependent locations: under diaphragm (upright), around liver (supine)
• "Rigler's sign" on XR: both sides of bowel wall visible
• Look for site of perforation: focal bowel wall defect, adjacent inflammatory changes
• Surgical emergency - requires operative exploration in most cases`,
  findings: `Large volume of free intraperitoneal air with air outlining the falciform ligament and tracking around the liver and spleen. Extraluminal air also seen in the lesser sac and surrounding the anterior wall of the duodenal bulb. Focal discontinuity of the anterior wall of the duodenal bulb with adjacent fat stranding, consistent with perforation at this site. Moderate free fluid in the pelvis. No portal venous gas. Findings consistent with perforated duodenal ulcer.`
}, ['Emergency', 'Life-Threatening', 'Must-Know']);

addCase({
  title: 'Ovarian Torsion',
  modality: 'US',
  body_part: 'Pelvis',
  diagnosis: 'Ovarian Torsion',
  difficulty: 3,
  clinical_history: '19-year-old female with sudden onset severe right lower quadrant pain, nausea, and vomiting. Known ovarian cyst. Pain partially relieved then returned.',
  teaching_points: `• Enlarged edematous ovary (>4cm) with peripherally displaced follicles
• "Whirlpool sign": twisted vascular pedicle on color Doppler
• Absent or decreased arterial and venous flow on Doppler (though presence doesn't exclude torsion)
• Often associated with ovarian mass/cyst (dermoid, cystadenoma) acting as lead point
• Waxing/waning pain may indicate intermittent torsion
• Surgical emergency - laparoscopic detorsion to preserve ovarian function`,
  findings: `The right ovary is markedly enlarged measuring 6.2 x 4.5 x 4.8 cm, compared to the normal left ovary measuring 3.0 x 2.0 cm. Peripheral displacement of small follicles with central stromal edema. Heterogeneous echogenicity of the right ovarian stroma. Twisting of the vascular pedicle (whirlpool sign) identified with color Doppler. Absent arterial and venous flow within the right ovary. A 4cm simple cyst within the right ovary likely serving as lead point. Small amount of free pelvic fluid. Findings highly concerning for right ovarian torsion.`
}, ['Emergency', 'Must-Know']);

addCase({
  title: 'Cauda Equina Syndrome',
  modality: 'MRI',
  body_part: 'Spine',
  diagnosis: 'Cauda Equina Syndrome from Large Disc Herniation',
  difficulty: 2,
  clinical_history: '45-year-old male with severe low back pain radiating to both legs, progressive bilateral leg weakness, saddle anesthesia, and urinary retention.',
  teaching_points: `• Large central disc herniation compressing the cauda equina nerve roots
• Classic triad: saddle anesthesia, bladder/bowel dysfunction, bilateral leg weakness
• Red flag symptoms requiring emergent MRI and surgical decompression
• Most common level: L4-L5 and L5-S1
• Delay in surgery (>48 hours) associated with worse neurological outcomes
• Complete vs incomplete CES affects prognosis`,
  findings: `Large central and left paracentral disc extrusion at L4-L5 measuring 15mm in AP dimension. The disc fragment extends inferiorly behind the L5 vertebral body. Severe narrowing of the central canal with compression and clumping of the cauda equina nerve roots. The disc material displaces the traversing L5 and S1 nerve roots bilaterally. No cord signal abnormality (conus terminates at L1). Moderate degenerative disc changes at adjacent levels. Findings consistent with cauda equina syndrome requiring emergent surgical decompression.`
}, ['Emergency', 'Life-Threatening', 'Must-Know', 'Degenerative']);

addCase({
  title: 'Mesenteric Ischemia',
  modality: 'CT',
  body_part: 'Abdomen',
  diagnosis: 'Acute Superior Mesenteric Artery Occlusion',
  difficulty: 3,
  clinical_history: '72-year-old female with atrial fibrillation presenting with sudden severe periumbilical pain "out of proportion to exam." Nausea, vomiting, and bloody diarrhea.',
  teaching_points: `• SMA filling defect (embolus usually lodges distal to middle colic artery origin)
• Bowel findings: paper-thin or thickened wall, absent enhancement, pneumatosis intestinalis
• "Pain out of proportion to physical exam" - classic early presentation
• Causes: embolism (AFib, MI), thrombosis (atherosclerosis), venous thrombosis (hypercoagulable)
• Portal/mesenteric venous gas = advanced ischemia, often too late
• Time is bowel - mortality 60-80% with delayed diagnosis`,
  findings: `Complete occlusion of the superior mesenteric artery approximately 3cm from its origin, with a meniscus-shaped filling defect consistent with acute embolus. Multiple dilated small bowel loops with paper-thin walls and decreased mucosal enhancement. Focal pneumatosis intestinalis in the jejunum. Small volume of portal venous gas in the peripheral liver. Mild mesenteric fat stranding. The affected small bowel extends from the proximal jejunum to the mid-ileum. The large bowel is spared. Findings consistent with acute mesenteric ischemia with early necrosis.`
}, ['Emergency', 'Vascular', 'Life-Threatening', 'Must-Know']);

addCase({
  title: 'Testicular Torsion',
  modality: 'US',
  body_part: 'Pelvis',
  diagnosis: 'Testicular Torsion',
  difficulty: 2,
  clinical_history: '14-year-old male with sudden onset severe left scrotal pain waking him from sleep. Nausea and vomiting. Absent cremasteric reflex, high-riding testis.',
  teaching_points: `• Enlarged, heterogeneous testis with decreased or absent color Doppler flow
• "Whirlpool sign" of twisted spermatic cord above testis
• Compare to asymptomatic side - asymmetric/absent flow is key
• Bell-clapper deformity (horizontal lie) predisposes to torsion
• Window for salvage: <6 hours = 90% salvage rate, >24 hours = <10%
• Intermittent torsion may have normal Doppler at time of imaging`,
  findings: `The left testis is enlarged and heterogeneous compared to the normal right testis. Absent color and spectral Doppler flow within the left testicular parenchyma, while the right testis demonstrates normal arterial and venous flow. The left epididymis is also enlarged. Twisting of the spermatic cord identified superior to the left testis (whirlpool sign). Small left hydrocele. Increased echogenicity of the peritesticular soft tissues. The right testis is normal in size and echogenicity. Findings consistent with left testicular torsion.`
}, ['Emergency', 'Pediatric', 'Life-Threatening', 'Must-Know']);

addCase({
  title: 'Cholecystitis with Cholelithiasis',
  modality: 'US',
  body_part: 'Abdomen',
  diagnosis: 'Acute Calculous Cholecystitis',
  difficulty: 2,
  clinical_history: '45-year-old female with right upper quadrant pain radiating to the back after eating a fatty meal. Fever, nausea, and positive Murphy sign on exam.',
  teaching_points: `• Gallstones (hyperechoic with posterior acoustic shadowing) impacted in GB neck/cystic duct
• Wall thickening >3mm, pericholecystic fluid, sonographic Murphy sign
• GB distension (>4cm transverse diameter)
• Complications: gangrenous cholecystitis, emphysematous cholecystitis, perforation
• HIDA scan for equivocal cases (non-visualization of GB = cystic duct obstruction)
• 4 F's risk factors: Female, Forty, Fertile, Fat`,
  findings: `Multiple echogenic foci within the gallbladder with posterior acoustic shadowing, consistent with cholelithiasis. A 1.5cm stone is impacted in the gallbladder neck. The gallbladder is distended measuring 11 x 5 cm with wall thickening to 6mm. Pericholecystic fluid is present. Positive sonographic Murphy sign (focal tenderness over the gallbladder with transducer pressure). The common bile duct measures 5mm and is not dilated. No intrahepatic biliary dilation. Findings consistent with acute calculous cholecystitis.`
}, ['Emergency', 'Must-Know', 'Classic', 'Boards Favorite']);

console.log('\n✓ Curated teaching cases added successfully!');
console.log('\nSummary of cases by modality:');

const modalities = db.prepare(`
  SELECT modality, COUNT(*) as count
  FROM cases
  GROUP BY modality
  ORDER BY count DESC
`).all();
for (const m of modalities) {
  console.log(`  ${m.modality}: ${m.count} cases`);
}

const total = db.prepare('SELECT COUNT(*) as count FROM cases').get();
console.log(`\nTotal: ${total.count} teaching cases ready for DICOM upload`);
