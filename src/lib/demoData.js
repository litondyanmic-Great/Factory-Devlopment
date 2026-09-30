export const DEFAULT_SAMPLE_STYLES = [
  {
    id: 'style-hm-01',
    styleNo: 'HM-2026/SW-01',
    styleName: "Men's Crew Neck Pullover",
    buyer: 'H&M',
    poNo: 'PO-994821',
    orderQty: 4800,
    orderDate: '2026-09-15',
    shipDate: '2026-10-25',
    gg: '12 GG',
    yarnComposition: '100% Acrylic Soft 2/28 Nm',
    notes: 'Primary export line for European distribution',
    colour: 'Navy Blue (2,400), Heather Grey (2,400)',
    stages: {
      knitting: 4200,
      linking: 3600,
      trimming: 3400,
      mending: 3200,
      lightCheck: 3100,
      sewing: 3000,
      attachment: 2900,
      wash: 2800,
      pqc: 2700,
      iron: 2600,
      getup: 2500,
      packing: 2400,
    },
    productionStarted: true,
    createdAt: '2026-09-15T00:00:00.000Z',
  },
  {
    id: 'style-zr-02',
    styleNo: 'ZR-2026/CD-04',
    styleName: "Women's Cable Knit Cardigan",
    buyer: 'Zara',
    poNo: 'PO-ZR-88401',
    orderQty: 3200,
    orderDate: '2026-09-18',
    shipDate: '2026-11-05',
    gg: '7 GG',
    yarnComposition: 'Wool Blend 2/32 Nm',
    notes: 'Premium cable knit pattern',
    colour: 'Ivory (1,800), Camel (1,400)',
    stages: {
      knitting: 2600,
      linking: 2100,
      trimming: 1950,
      mending: 1800,
      lightCheck: 1700,
      sewing: 1600,
      attachment: 1500,
      wash: 1400,
      pqc: 1300,
      iron: 1200,
      getup: 1100,
      packing: 1050,
    },
    productionStarted: true,
    createdAt: '2026-09-18T00:00:00.000Z',
  },
  {
    id: 'style-nx-03',
    styleNo: 'NX-2026/HD-09',
    styleName: 'Jacquard Heavy Knit Hoodie',
    buyer: 'Next UK',
    poNo: 'PO-NX-44129',
    orderQty: 2500,
    orderDate: '2026-09-20',
    shipDate: '2026-11-15',
    gg: '5 GG',
    yarnComposition: '100% Cotton Melange 20/2',
    notes: 'Custom jacquard pattern design',
    colour: 'Charcoal Grey (2,500)',
    stages: {
      knitting: 1800,
      linking: 1200,
      trimming: 950,
      mending: 850,
      lightCheck: 750,
      sewing: 650,
      attachment: 600,
      wash: 550,
      pqc: 500,
      iron: 450,
      getup: 400,
      packing: 350,
    },
    productionStarted: true,
    createdAt: '2026-09-20T00:00:00.000Z',
  },
  {
    id: 'style-mks-04',
    styleNo: 'MKS-2026/VT-12',
    styleName: 'V-Neck Fine Gauge Sleeveless Vest',
    buyer: 'M&S',
    poNo: 'PO-MKS-1104',
    orderQty: 5000,
    orderDate: '2026-09-22',
    shipDate: '2026-11-30',
    gg: '14 GG',
    yarnComposition: '100% Combed Cotton 2/30',
    notes: 'Pre-production approved',
    colour: 'Black (2,500), White (2,500)',
    stages: {
      knitting: 1100,
      linking: 800,
      trimming: 700,
      mending: 600,
      lightCheck: 500,
      sewing: 400,
      attachment: 350,
      wash: 300,
      pqc: 250,
      iron: 200,
      getup: 150,
      packing: 100,
    },
    productionStarted: true,
    createdAt: '2026-09-22T00:00:00.000Z',
  },
];

export const DEFAULT_SAMPLE_ITEMS = [
  {
    id: 'yarn-demo-01',
    name: '2/28 Nm 100% Acrylic Soft Yarn (Navy Blue)',
    type: 'yarn',
    unit: 'lb',
    stock: 1250,
    location: 'Block B',
    supplier: 'Square Textiles Ltd.',
    reorderLevel: 500,
    createdAt: '2026-09-10',
  },
  {
    id: 'yarn-demo-02',
    name: '2/32 Nm Wool Blend Yarn (Ivory Heather)',
    type: 'yarn',
    unit: 'lb',
    stock: 840,
    location: 'Block D',
    supplier: 'Badar Spinning Mills',
    reorderLevel: 400,
    createdAt: '2026-09-12',
  },
  {
    id: 'yarn-demo-03',
    name: '100% Cotton Melange 20/2 (Charcoal Grey)',
    type: 'yarn',
    unit: 'lb',
    stock: 920,
    location: 'Block A',
    supplier: 'Envoy Textiles',
    reorderLevel: 300,
    createdAt: '2026-09-14',
  },
  {
    id: 'acc-demo-01',
    name: 'Main Brand Woven Label (H&M Standard)',
    type: 'accessory',
    unit: 'pcs',
    stock: 14500,
    location: 'Acc Rack 12',
    supplier: 'Montrims Ltd.',
    reorderLevel: 2000,
    createdAt: '2026-09-10',
  },
  {
    id: 'acc-demo-02',
    name: 'Care & Composition Printed Label',
    type: 'accessory',
    unit: 'pcs',
    stock: 11200,
    location: 'Acc Rack 14',
    supplier: 'Dekko Accessories',
    reorderLevel: 1500,
    createdAt: '2026-09-10',
  },
  {
    id: 'acc-demo-03',
    name: 'Individual Polybag (Self-Adhesive 14x18")',
    type: 'accessory',
    unit: 'pcs',
    stock: 8500,
    location: 'Poly Rack A',
    supplier: 'KDS Packaging Ltd.',
    reorderLevel: 1000,
    createdAt: '2026-09-12',
  },
];

export const DEFAULT_SAMPLE_USERS = [
  {
    id: 'usr-admin-01',
    name: 'Factory Admin',
    email: 'admin@factoryerp.com',
    role: 'admin',
    department: 'admin',
    status: 'active',
    sections: ['knitting', 'linking', 'wash', 'packing'],
    adminAreas: ['quality', 'production', 'inventory', 'reports'],
    createdAt: '2026-01-01',
  },
  {
    id: 'usr-store-02',
    name: 'Kalam Hossain (Store Manager)',
    email: 'store@factoryerp.com',
    role: 'store',
    department: 'store',
    status: 'active',
    sections: ['yarnStore', 'winding', 'accessoriesStore'],
    adminAreas: ['inventory'],
    createdAt: '2026-02-15',
  },
  {
    id: 'usr-prod-03',
    name: 'Engr. Azad (Production Manager)',
    email: 'production@factoryerp.com',
    role: 'production',
    department: 'production',
    status: 'active',
    sections: ['knitting', 'linking', 'trimming', 'sewing', 'iron'],
    adminAreas: ['production'],
    createdAt: '2026-02-20',
  },
  {
    id: 'usr-gpq-04',
    name: 'Faruk Ahmed (GPQ Quality Head)',
    email: 'quality@factoryerp.com',
    role: 'gpq',
    department: 'gpq',
    status: 'active',
    sections: ['lightCheck', 'pqc', 'getup'],
    adminAreas: ['quality'],
    createdAt: '2026-03-01',
  },
  {
    id: 'usr-ie-05',
    name: 'Tareq Mahmud (IE Officer)',
    email: 'ie@factoryerp.com',
    role: 'ie',
    department: 'ie',
    status: 'active',
    sections: ['knitting', 'linking'],
    adminAreas: [],
    createdAt: '2026-03-10',
  },
];

export const DEFAULT_SAMPLE_PRODUCTION_ENTRIES = [
  {
    id: 'pe-01',
    styleId: 'style-hm-01',
    stage: 'knitting',
    quantity: 350,
    date: new Date().toISOString().slice(0, 10),
    enteredBy: 'Production Team',
    notes: 'Shift A regular run',
  },
  {
    id: 'pe-02',
    styleId: 'style-hm-01',
    stage: 'linking',
    quantity: 300,
    date: new Date().toISOString().slice(0, 10),
    enteredBy: 'Production Team',
    notes: 'Floor 2 Linking lines',
  },
  {
    id: 'pe-03',
    styleId: 'style-hm-01',
    stage: 'packing',
    quantity: 240,
    date: new Date().toISOString().slice(0, 10),
    enteredBy: 'Finishing Team',
    notes: 'Final pack completed for Batch 1',
  },
  {
    id: 'pe-04',
    styleId: 'style-zr-02',
    stage: 'knitting',
    quantity: 220,
    date: new Date().toISOString().slice(0, 10),
    enteredBy: 'Production Team',
    notes: 'Cable knit panel production',
  },
  {
    id: 'pe-05',
    styleId: 'style-zr-02',
    stage: 'packing',
    quantity: 180,
    date: new Date().toISOString().slice(0, 10),
    enteredBy: 'Finishing Team',
    notes: 'Cartoned ready for audit',
  },
  {
    id: 'pe-06',
    styleId: 'style-nx-03',
    stage: 'knitting',
    quantity: 150,
    date: new Date().toISOString().slice(0, 10),
    enteredBy: 'Production Team',
  },
  {
    id: 'pe-07',
    styleId: 'style-nx-03',
    stage: 'packing',
    quantity: 120,
    date: new Date().toISOString().slice(0, 10),
    enteredBy: 'Finishing Team',
  },
];

export const DEFAULT_SAMPLE_QUALITY_CHECKS = [
  {
    id: 'qc-01',
    styleId: 'style-hm-01',
    styleLabel: "HM-2026/SW-01 — Men's Crew Neck Pullover",
    section: 'knitting',
    date: new Date().toISOString().slice(0, 10),
    checkedQty: 250,
    defectQty: 3,
    passRate: 98.8,
    block: 'Block A',
    enteredBy: 'Faruk Ahmed (GPQ)',
    defects: { dropStitch: 2, tensionUneven: 1 },
  },
  {
    id: 'qc-02',
    styleId: 'style-hm-01',
    styleLabel: "HM-2026/SW-01 — Men's Crew Neck Pullover",
    section: 'linking',
    date: new Date().toISOString().slice(0, 10),
    checkedQty: 200,
    defectQty: 2,
    passRate: 99.0,
    block: 'Block A',
    enteredBy: 'Faruk Ahmed (GPQ)',
    defects: { linkingHole: 1, looseThread: 1 },
  },
  {
    id: 'qc-03',
    styleId: 'style-zr-02',
    styleLabel: "ZR-2026/CD-04 — Women's Cable Knit Cardigan",
    section: 'pqc',
    date: new Date().toISOString().slice(0, 10),
    checkedQty: 180,
    defectQty: 4,
    passRate: 97.8,
    block: 'Block B',
    enteredBy: 'Faruk Ahmed (GPQ)',
    defects: { measurementOut: 2, ironMark: 2 },
  },
];

export const DEFAULT_SAMPLE_ZERO_THREAD = [
  {
    id: 'zt-01',
    section: 'knitting',
    date: new Date().toISOString().slice(0, 10),
    status: 'green',
    totalDefectQty: 1,
    checkedQty: 100,
    notes: 'Normal inspection pass',
  },
  {
    id: 'zt-02',
    section: 'linking',
    date: new Date().toISOString().slice(0, 10),
    status: 'green',
    totalDefectQty: 2,
    checkedQty: 120,
    notes: 'Clean floor run',
  },
];

export const DEFAULT_SAMPLE_YARN_LEDGER = [
  {
    id: 'yl-01',
    styleId: 'style-hm-01',
    yarnItemId: 'yarn-demo-01',
    yarnItemName: '2/28 Nm 100% Acrylic Soft Yarn (Navy Blue)',
    type: 'receipt',
    qty: 2500,
    date: '2026-09-18',
    chalanNo: 'CH-SQ-991',
    notes: 'Received from Square Textiles',
  },
  {
    id: 'yl-02',
    styleId: 'style-hm-01',
    yarnItemId: 'yarn-demo-01',
    yarnItemName: '2/28 Nm 100% Acrylic Soft Yarn (Navy Blue)',
    type: 'issueToWinding',
    qty: 1200,
    date: '2026-09-20',
    notes: 'Batch 1 winding issue',
  },
  {
    id: 'yl-03',
    styleId: 'style-hm-01',
    yarnItemId: 'yarn-demo-01',
    yarnItemName: '2/28 Nm 100% Acrylic Soft Yarn (Navy Blue)',
    type: 'windingToKnitting',
    qty: 1100,
    date: '2026-09-22',
    notes: 'Wound cones delivered to knitting',
  },
];

export const DEFAULT_SAMPLE_ACC_LEDGER = [
  {
    id: 'al-01',
    styleId: 'style-hm-01',
    itemId: 'acc-demo-01',
    itemName: 'Main Brand Woven Label (H&M Standard)',
    type: 'receipt',
    qty: 5000,
    date: '2026-09-18',
    unit: 'pcs',
  },
  {
    id: 'al-02',
    styleId: 'style-hm-01',
    itemId: 'acc-demo-01',
    itemName: 'Main Brand Woven Label (H&M Standard)',
    type: 'issue',
    qty: 3200,
    date: '2026-09-24',
    unit: 'pcs',
  },
];

export const DEFAULT_SAMPLE_IE_TARGETS = [
  {
    styleId: 'style-hm-01',
    styleNo: 'HM-2026/SW-01',
    styleName: "Men's Crew Neck Pullover",
    buyer: 'H&M',
    stage: 'knitting',
    dailyTarget: 600,
    hourlyTarget: 75,
    smv: 8.5,
    manpower: 12,
    workingHours: 8,
    targetEfficiency: 85,
    notes: 'Gauge 12 GG automated Shima Seiki machines',
    updatedAt: '2026-09-20T08:00:00.000Z',
  },
  {
    styleId: 'style-zr-02',
    styleNo: 'ZR-2026/CD-04',
    styleName: "Women's Cable Knit Cardigan",
    buyer: 'Zara',
    stage: 'knitting',
    dailyTarget: 400,
    hourlyTarget: 50,
    smv: 12.0,
    manpower: 10,
    workingHours: 8,
    targetEfficiency: 80,
    notes: 'Complex 7GG cable jacquard pattern',
    updatedAt: '2026-09-21T08:00:00.000Z',
  },
  {
    styleId: 'style-nx-03',
    styleNo: 'NX-2026/HD-09',
    styleName: 'Jacquard Heavy Knit Hoodie',
    buyer: 'Next UK',
    stage: 'linking',
    dailyTarget: 350,
    hourlyTarget: 44,
    smv: 14.5,
    manpower: 11,
    workingHours: 8,
    targetEfficiency: 75,
    notes: 'Dial linking section line 3',
    updatedAt: '2026-09-22T08:00:00.000Z',
  },
];

export const DEFAULT_SAMPLE_IE_RECORDS = [
  {
    id: 'ie-rec-01',
    styleId: 'style-hm-01',
    styleNo: 'HM-2026/SW-01',
    styleName: "Men's Crew Neck Pullover",
    buyer: 'H&M',
    date: '2026-09-25',
    stage: 'knitting',
    smv: 8.5,
    manpower: 12,
    workingHours: 8,
    targetEfficiencyPct: 85,
    standardTargetQty: 678,
    targetQty: 576,
    actualQty: 590,
    achievedEfficiencyPct: 87.0,
    notes: 'Day shift ran smoothly without yarn breakage',
    enteredBy: 'IE In-Charge',
    createdAt: '2026-09-25T17:00:00.000Z',
  },
  {
    id: 'ie-rec-02',
    styleId: 'style-zr-02',
    styleNo: 'ZR-2026/CD-04',
    styleName: "Women's Cable Knit Cardigan",
    buyer: 'Zara',
    date: '2026-09-25',
    stage: 'knitting',
    smv: 12.0,
    manpower: 10,
    workingHours: 8,
    targetEfficiencyPct: 80,
    standardTargetQty: 400,
    targetQty: 320,
    actualQty: 335,
    achievedEfficiencyPct: 83.8,
    notes: 'Needle change took 25 mins in morning',
    enteredBy: 'IE In-Charge',
    createdAt: '2026-09-25T17:30:00.000Z',
  },
  {
    id: 'ie-rec-03',
    styleId: 'style-nx-03',
    styleNo: 'NX-2026/HD-09',
    styleName: 'Jacquard Heavy Knit Hoodie',
    buyer: 'Next UK',
    date: '2026-09-25',
    stage: 'linking',
    smv: 14.5,
    manpower: 11,
    workingHours: 8,
    targetEfficiencyPct: 75,
    standardTargetQty: 364,
    targetQty: 273,
    actualQty: 250,
    achievedEfficiencyPct: 68.7,
    notes: '2 linking operators absent on line 2',
    enteredBy: 'IE In-Charge',
    createdAt: '2026-09-25T18:00:00.000Z',
  },
  {
    id: 'ie-rec-04',
    styleId: 'style-hm-01',
    styleNo: 'HM-2026/SW-01',
    styleName: "Men's Crew Neck Pullover",
    buyer: 'H&M',
    date: '2026-09-24',
    stage: 'knitting',
    smv: 8.5,
    manpower: 12,
    workingHours: 8,
    targetEfficiencyPct: 85,
    standardTargetQty: 678,
    targetQty: 576,
    actualQty: 560,
    achievedEfficiencyPct: 82.6,
    notes: 'Machine calibration completed',
    enteredBy: 'IE In-Charge',
    createdAt: '2026-09-24T17:00:00.000Z',
  },
];

export const DEFAULT_SAMPLE_PACKING_LISTS = [
  {
    id: 'pack-hm-01',
    styleNo: 'HM-2026/SW-01',
    styleName: "Men's Crew Neck Pullover",
    buyer: 'H&M Hennes & Mauritz GBC AB',
    poNo: 'PO-994821',
    invoiceNo: 'INV-2026-EXP-088',
    destination: 'Hamburg Port, Germany',
    countryOfOrigin: 'Bangladesh',
    cartonLengthCm: 60,
    cartonWidthCm: 40,
    cartonHeightCm: 30,
    cartonNetWeightKg: 12.0,
    cartonGrossWeightKg: 13.5,
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    updatedAt: '2026-09-29T10:00:00.000Z',
    rows: [
      { id: 1, ctnFrom: 1, ctnTo: 20, color: 'Navy Blue', sizeRatios: { XS: 0, S: 5, M: 10, L: 10, XL: 5, XXL: 0 }, pcsPerCtn: 30 },
      { id: 2, ctnFrom: 21, ctnTo: 45, color: 'Navy Blue', sizeRatios: { XS: 0, S: 6, M: 12, L: 8, XL: 4, XXL: 0 }, pcsPerCtn: 30 },
      { id: 3, ctnFrom: 46, ctnTo: 70, color: 'Heather Grey', sizeRatios: { XS: 4, S: 8, M: 10, L: 6, XL: 2, XXL: 0 }, pcsPerCtn: 30 },
      { id: 4, ctnFrom: 71, ctnTo: 90, color: 'Heather Grey', sizeRatios: { XS: 0, S: 5, M: 10, L: 10, XL: 5, XXL: 0 }, pcsPerCtn: 30 },
    ],
  },
  {
    id: 'pack-zr-02',
    styleNo: 'ZR-2026/CD-04',
    styleName: "Women's Cable Knit Cardigan",
    buyer: 'Zara Inditex Group',
    poNo: 'PO-881240',
    invoiceNo: 'INV-2026-EXP-092',
    destination: 'Barcelona Port, Spain',
    countryOfOrigin: 'Bangladesh',
    cartonLengthCm: 55,
    cartonWidthCm: 38,
    cartonHeightCm: 32,
    cartonNetWeightKg: 11.5,
    cartonGrossWeightKg: 13.0,
    sizes: ['S', 'M', 'L', 'XL'],
    updatedAt: '2026-09-29T14:30:00.000Z',
    rows: [
      { id: 1, ctnFrom: 1, ctnTo: 30, color: 'Ivory Cream', sizeRatios: { S: 6, M: 12, L: 8, XL: 4 }, pcsPerCtn: 30 },
      { id: 2, ctnFrom: 31, ctnTo: 60, color: 'Sage Green', sizeRatios: { S: 5, M: 10, L: 10, XL: 5 }, pcsPerCtn: 30 },
    ],
  },
];

export function isDemoDataCleared() {
  try {
    return localStorage.getItem('factory_erp_demo_cleared') === 'true';
  } catch {
    return false;
  }
}

export function clearAllDemoData() {
  try {
    localStorage.setItem('factory_erp_demo_cleared', 'true');
    localStorage.setItem('factory_erp_local_styles', JSON.stringify([]));
    localStorage.setItem('factory_erp_local_items', JSON.stringify([]));
    localStorage.setItem('factory_erp_local_prod_entries', JSON.stringify([]));
    localStorage.setItem('factory_erp_local_quality_checks', JSON.stringify([]));
    localStorage.setItem('factory_erp_local_zero_thread', JSON.stringify([]));
    localStorage.setItem('factory_erp_local_yarn_ledger', JSON.stringify([]));
    localStorage.setItem('factory_erp_local_acc_ledger', JSON.stringify([]));
    localStorage.setItem('factory_erp_local_packing_lists', JSON.stringify([]));
    localStorage.setItem('factory_erp_local_ie_targets', JSON.stringify([]));
    localStorage.setItem('factory_erp_local_ie_records', JSON.stringify([]));
    localStorage.setItem('factory_erp_bundles_data', JSON.stringify([]));
    localStorage.setItem('factory_erp_chalans_data', JSON.stringify([]));
    window.dispatchEvent(new Event('factory_erp_data_updated'));
    return true;
  } catch (e) {
    console.error('Error clearing demo data:', e);
    return false;
  }
}

export function restoreDemoData() {
  try {
    localStorage.removeItem('factory_erp_demo_cleared');
    localStorage.setItem('factory_erp_local_styles', JSON.stringify(DEFAULT_SAMPLE_STYLES));
    localStorage.setItem('factory_erp_local_items', JSON.stringify(DEFAULT_SAMPLE_ITEMS));
    localStorage.setItem('factory_erp_local_users', JSON.stringify(DEFAULT_SAMPLE_USERS));
    localStorage.setItem('factory_erp_local_prod_entries', JSON.stringify(DEFAULT_SAMPLE_PRODUCTION_ENTRIES));
    localStorage.setItem('factory_erp_local_quality_checks', JSON.stringify(DEFAULT_SAMPLE_QUALITY_CHECKS));
    localStorage.setItem('factory_erp_local_zero_thread', JSON.stringify(DEFAULT_SAMPLE_ZERO_THREAD));
    localStorage.setItem('factory_erp_local_yarn_ledger', JSON.stringify(DEFAULT_SAMPLE_YARN_LEDGER));
    localStorage.setItem('factory_erp_local_acc_ledger', JSON.stringify(DEFAULT_SAMPLE_ACC_LEDGER));
    localStorage.setItem('factory_erp_local_packing_lists', JSON.stringify(DEFAULT_SAMPLE_PACKING_LISTS));
    localStorage.setItem('factory_erp_local_ie_targets', JSON.stringify(DEFAULT_SAMPLE_IE_TARGETS));
    localStorage.setItem('factory_erp_local_ie_records', JSON.stringify(DEFAULT_SAMPLE_IE_RECORDS));
    window.dispatchEvent(new Event('factory_erp_data_updated'));
    return true;
  } catch {
    return false;
  }
}

export function getLocalStyles() {
  try {
    const raw = localStorage.getItem('factory_erp_local_styles');
    if (raw !== null) return JSON.parse(raw);
    if (isDemoDataCleared()) return [];
  } catch {}
  return isDemoDataCleared() ? [] : DEFAULT_SAMPLE_STYLES;
}

export function saveLocalStyles(styles) {
  try {
    localStorage.setItem('factory_erp_local_styles', JSON.stringify(styles));
    window.dispatchEvent(new Event('factory_erp_data_updated'));
  } catch {}
}

export function deleteLocalStyle(styleId) {
  const styles = getLocalStyles().filter((s) => s.id !== styleId);
  saveLocalStyles(styles);
  const entries = getLocalProductionEntries().filter((e) => e.styleId !== styleId);
  saveLocalProductionEntries(entries);
  const yarn = getLocalYarnLedger().filter((y) => y.styleId !== styleId);
  saveLocalYarnLedger(yarn);
  const acc = getLocalAccLedger().filter((a) => a.styleId !== styleId);
  saveLocalAccLedger(acc);
  return styles;
}

export function updateLocalStyle(styleId, updatedData) {
  const styles = getLocalStyles().map((s) => (s.id === styleId ? { ...s, ...updatedData } : s));
  saveLocalStyles(styles);
  return styles;
}

export function getLocalItems() {
  try {
    const raw = localStorage.getItem('factory_erp_local_items');
    if (raw !== null) return JSON.parse(raw);
    if (isDemoDataCleared()) return [];
  } catch {}
  return isDemoDataCleared() ? [] : DEFAULT_SAMPLE_ITEMS;
}

export function saveLocalItems(items) {
  try {
    localStorage.setItem('factory_erp_local_items', JSON.stringify(items));
    window.dispatchEvent(new Event('factory_erp_data_updated'));
  } catch {}
}

export function deleteLocalItem(itemId) {
  const items = getLocalItems().filter((i) => i.id !== itemId);
  saveLocalItems(items);
  return items;
}

export function updateLocalItem(itemId, updatedData) {
  const items = getLocalItems().map((i) => (i.id === itemId ? { ...i, ...updatedData } : i));
  saveLocalItems(items);
  return items;
}

export function getLocalUsers() {
  try {
    const raw = localStorage.getItem('factory_erp_local_users');
    if (raw !== null) return JSON.parse(raw);
    if (isDemoDataCleared()) return [];
  } catch {}
  return isDemoDataCleared() ? [] : DEFAULT_SAMPLE_USERS;
}

export function saveLocalUsers(users) {
  try {
    localStorage.setItem('factory_erp_local_users', JSON.stringify(users));
    window.dispatchEvent(new Event('factory_erp_data_updated'));
  } catch {}
}

export function getLocalProductionEntries() {
  try {
    const raw = localStorage.getItem('factory_erp_local_prod_entries');
    if (raw !== null) return JSON.parse(raw);
    if (isDemoDataCleared()) return [];
  } catch {}
  return isDemoDataCleared() ? [] : DEFAULT_SAMPLE_PRODUCTION_ENTRIES;
}

export function saveLocalProductionEntries(entries) {
  try {
    localStorage.setItem('factory_erp_local_prod_entries', JSON.stringify(entries));
    window.dispatchEvent(new Event('factory_erp_data_updated'));
  } catch {}
}

export function deleteLocalProductionEntry(entryId) {
  const entries = getLocalProductionEntries().filter((e) => e.id !== entryId);
  saveLocalProductionEntries(entries);
  return entries;
}

export function updateLocalProductionEntry(entryId, updatedData) {
  const entries = getLocalProductionEntries().map((e) => (e.id === entryId ? { ...e, ...updatedData } : e));
  saveLocalProductionEntries(entries);
  return entries;
}

export function getLocalQualityChecks() {
  try {
    const raw = localStorage.getItem('factory_erp_local_quality_checks');
    if (raw !== null) return JSON.parse(raw);
    if (isDemoDataCleared()) return [];
  } catch {}
  return isDemoDataCleared() ? [] : DEFAULT_SAMPLE_QUALITY_CHECKS;
}

export function saveLocalQualityChecks(checks) {
  try {
    localStorage.setItem('factory_erp_local_quality_checks', JSON.stringify(checks));
    window.dispatchEvent(new Event('factory_erp_data_updated'));
  } catch {}
}

export function deleteLocalQualityCheck(checkId) {
  const checks = getLocalQualityChecks().filter((c) => c.id !== checkId);
  saveLocalQualityChecks(checks);
  return checks;
}

export function getLocalZeroThread() {
  try {
    const raw = localStorage.getItem('factory_erp_local_zero_thread');
    if (raw !== null) return JSON.parse(raw);
    if (isDemoDataCleared()) return [];
  } catch {}
  return isDemoDataCleared() ? [] : DEFAULT_SAMPLE_ZERO_THREAD;
}

export function saveLocalZeroThread(data) {
  try {
    localStorage.setItem('factory_erp_local_zero_thread', JSON.stringify(data));
    window.dispatchEvent(new Event('factory_erp_data_updated'));
  } catch {}
}

export function getLocalYarnLedger() {
  try {
    const raw = localStorage.getItem('factory_erp_local_yarn_ledger');
    if (raw !== null) return JSON.parse(raw);
    if (isDemoDataCleared()) return [];
  } catch {}
  return isDemoDataCleared() ? [] : DEFAULT_SAMPLE_YARN_LEDGER;
}

export function saveLocalYarnLedger(data) {
  try {
    localStorage.setItem('factory_erp_local_yarn_ledger', JSON.stringify(data));
    window.dispatchEvent(new Event('factory_erp_data_updated'));
  } catch {}
}

export function deleteLocalYarnLedger(id) {
  const data = getLocalYarnLedger().filter((y) => y.id !== id);
  saveLocalYarnLedger(data);
  return data;
}

export function getLocalAccLedger() {
  try {
    const raw = localStorage.getItem('factory_erp_local_acc_ledger');
    if (raw !== null) return JSON.parse(raw);
    if (isDemoDataCleared()) return [];
  } catch {}
  return isDemoDataCleared() ? [] : DEFAULT_SAMPLE_ACC_LEDGER;
}

export function saveLocalAccLedger(data) {
  try {
    localStorage.setItem('factory_erp_local_acc_ledger', JSON.stringify(data));
    window.dispatchEvent(new Event('factory_erp_data_updated'));
  } catch {}
}

export function getLocalPackingLists() {
  try {
    const raw = localStorage.getItem('factory_erp_local_packing_lists');
    if (raw !== null) return JSON.parse(raw);
    if (isDemoDataCleared()) return [];
  } catch {}
  return isDemoDataCleared() ? [] : DEFAULT_SAMPLE_PACKING_LISTS;
}

export function saveLocalPackingLists(lists) {
  try {
    localStorage.setItem('factory_erp_local_packing_lists', JSON.stringify(lists));
    window.dispatchEvent(new Event('factory_erp_data_updated'));
  } catch {}
}

export function deleteLocalPackingList(id) {
  const current = getLocalPackingLists().filter((p) => p.id !== id);
  saveLocalPackingLists(current);
  return current;
}

export function getLocalIETargets() {
  try {
    const raw = localStorage.getItem('factory_erp_local_ie_targets');
    if (raw !== null) return JSON.parse(raw);
    if (isDemoDataCleared()) return [];
  } catch {}
  return isDemoDataCleared() ? [] : DEFAULT_SAMPLE_IE_TARGETS;
}

export function saveLocalIETargets(targets) {
  try {
    localStorage.setItem('factory_erp_local_ie_targets', JSON.stringify(targets));
    window.dispatchEvent(new Event('factory_erp_data_updated'));
  } catch {}
}

export function deleteLocalIETarget(styleId) {
  const current = getLocalIETargets().filter((t) => t.styleId !== styleId);
  saveLocalIETargets(current);
  return current;
}

export function getLocalIERecords() {
  try {
    const raw = localStorage.getItem('factory_erp_local_ie_records');
    if (raw !== null) return JSON.parse(raw);
    if (isDemoDataCleared()) return [];
  } catch {}
  return isDemoDataCleared() ? [] : DEFAULT_SAMPLE_IE_RECORDS;
}

export function saveLocalIERecords(records) {
  try {
    localStorage.setItem('factory_erp_local_ie_records', JSON.stringify(records));
    window.dispatchEvent(new Event('factory_erp_data_updated'));
  } catch {}
}

export function deleteLocalIERecord(id) {
  const current = getLocalIERecords().filter((r) => r.id !== id);
  saveLocalIERecords(current);
  return current;
}

export function updateLocalIERecord(id, updatedData) {
  const current = getLocalIERecords().map((r) => (r.id === id ? { ...r, ...updatedData } : r));
  saveLocalIERecords(current);
  return current;
}
