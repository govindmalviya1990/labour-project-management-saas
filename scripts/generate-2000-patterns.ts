import fs from 'fs';
import path from 'path';

interface QuestionPattern {
  id: string;
  category: string;
  intent: string;
  question: string;
  variations: string[];
  keywords: string[];
  description: string;
  isActionDraft?: boolean;
}

const WORKERS = [
  'Ramesh Kumar', 'Suresh Sharma', 'Sonu Kumar', 'Monu Yadav', 'Rinku Kumar',
  'Mukesh Varma', 'Dinesh Solanki', 'Kamlesh Patel', 'Vinod Rawat', 'Manoj Kumar',
  'Bablu Chauhan', 'Dharmendra Singh', 'Anil Thakor', 'Sunil Parmar', 'Pappu Lal',
  'Vikram Rathod', 'Prakash Meena', 'Ajay Vaghela', 'Jitendra Saini', 'Sanjay Rawal'
];

const SITES = [
  'Vastral site', 'Bopal project', 'SG Highway site', 'Thaltej bungalow',
  'Sanand industrial shed', 'Naroda factory', 'Gota high-rise', 'Nikol commercial',
  'Chandkheda project', 'Odhav godown', 'Prahlad Nagar site', 'Maninagar basement'
];

const PARTNERS = ['Akshay Tak', 'Govind Malviya', 'Rajesh Thakur', 'Manish Sharma', 'Amit Patel'];

const MATERIALS = [
  'Dr Fixit Fastflex', 'Dr Fixit URP 302', 'Pidifin 2K', 'APP membrane 3mm',
  'APP membrane 4mm', 'Bitumen primer', 'UltraTech cement', 'Ambuja cement',
  'PU coating', 'Fibre mesh roll', 'Epoxy grout', 'Gas cylinder torch'
];

const SUPPLIERS = [
  'Asian Paints', 'Pidilite Dr Fixit', 'Fosroc Chemicals', 'Sika India',
  'UltraTech Cement Dealer', 'Patel Hardware', 'Jayesh Building Materials',
  'Ambica Traders', 'Shree Ram Hardware', 'Gujarat Chemical Depot'
];

const BANKS = ['HDFC Bank', 'SBI Bank', 'ICICI Bank', 'Axis Bank'];

function buildPatterns(): QuestionPattern[] {
  const patterns: QuestionPattern[] = [];
  const seenQuestions = new Set<string>();

  function addPattern(p: QuestionPattern) {
    const qNorm = p.question.trim().toLowerCase();
    if (!seenQuestions.has(qNorm)) {
      seenQuestions.add(qNorm);
      patterns.push(p);
    }
  }

  // =========================================================================
  // 1. ATTENDANCE & HAJIRI (200 patterns)
  // =========================================================================
  // General Attendance (20)
  const generalAtt = [
    { q: 'Aaj kitne workers present hain?', v: ['aaj ki attendance dikhao', 'today worker attendance report', 'aaj kitni hajiri lagi hai'], d: 'Today present workers count' },
    { q: 'Kal ki attendance report dikhao', v: ['yesterday worker turnout', 'kal kitne majdoor aaye the', 'kal ka hajiri statement'], d: 'Yesterday worker turnout' },
    { q: 'Aaj half-day kis kis ka laga hai?', v: ['half day workers today', 'aaj aadha din kisne kaam kiya', 'today half day list'], d: 'Today half day workers' },
    { q: 'Kal kitne workers absent the?', v: ['yesterday absentee list', 'kal kaun kaun nahi aaya tha', 'kal ki gair-hajiri list'], d: 'Yesterday absentees' },
    { q: 'Is hafte ka total attendance summary dikhao', v: ['weekly attendance sheet', 'is week kitni shifts lagi', 'haftewar hajiri hisaab'], d: 'Weekly attendance summary' },
    { q: 'Is mahine ka total worker turnout kitna raha?', v: ['monthly attendance report', 'mahine bhar ki attendance sheet', 'month total hajiri count'], d: 'Monthly turnout' },
    { q: 'Aaj total kitne mistri aur kitne helper hain?', v: ['mistri helper ratio today', 'aaj kitne karigar aur mazdoor aaye', 'today skill wise attendance'], d: 'Skill wise breakdown' },
    { q: 'Overtime shifts aaj kis kis ki lagi hain?', v: ['aaj OT kisne kiya', 'today overtime workers list', 'extra shift workers today'], d: 'Overtime shifts' },
    { q: 'Sunday ko kis kis worker ne kaam kiya tha?', v: ['itwar ki attendance sheet', 'sunday shift workers list', 'weekend attendance report'], d: 'Sunday shift list' },
    { q: 'Pichhle hafte sabse zyada attendance kis worker ki thi?', v: ['most regular worker last week', 'pichhle hafte full hajiri kiski thi'], d: 'Most regular worker' },
    { q: 'Aaj attendance kisne aur kitne baje mark ki?', v: ['who marked attendance today', 'today attendance punch time', 'hajiri kis supervisor ne bhari'], d: 'Attendance audit' },
    { q: 'Aaj ki attendance ka estimated labour cost kitna bana?', v: ['aaj ki hajiri ke kitne paise bane', 'today labour wage total', 'today attendance cost'], d: 'Attendance wage estimate' },
    { q: 'Kal ki attendance ka kul kharch kitna tha?', v: ['yesterday labour cost', 'kal ki hajiri ka total amount', 'kal ka dihaadi kharcha'], d: 'Yesterday wage total' },
    { q: 'Lagatar 3 din se kaun se workers absent hain?', v: ['long absent workers list', 'kaun se labour 3 din se nahi aaye'], d: 'Long term absentees' },
    { q: 'Night shift mein kal kitne workers the?', v: ['kal raat ki shift hajiri', 'night duty workers attendance'], d: 'Night shift attendance' },
    { q: 'Aaj double shift kis kis worker ki lagi hai?', v: ['double hajiri workers today', 'two shifts today labour'], d: 'Double shift workers' },
    { q: 'Bina bataye kaun kaun se workers chhutti par hain?', v: ['uninformed leave workers', 'aaj bina notice gair hajir kaun hai'], d: 'Uninformed leaves' },
    { q: 'Is mahine sabse kam attendance kis worker ki rahi?', v: ['lowest attendance this month', 'is mahine sabse zyada chhutti kisne li'], d: 'Lowest attendance' },
    { q: 'Aaj total registered workers mein se kitne percent aaye hain?', v: ['today attendance percentage', 'aaj turnout percentage kya hai'], d: 'Turnout percentage' },
    { q: 'Kal ki attendance sheet mein koi correction hua tha kya?', v: ['yesterday attendance edits', 'kal ki hajiri mein koi badlaav hua kya'], d: 'Attendance correction' },
  ];
  generalAtt.forEach((item, idx) => {
    addPattern({
      id: `att-gen-${idx + 1}`,
      category: 'ATTENDANCE',
      intent: 'getAttendance',
      question: item.q,
      variations: item.v,
      keywords: ['attendance', 'hajiri', 'present', 'absent', 'turnout'],
      description: item.d,
    });
  });

  // Worker-specific attendance (60 patterns: 20 workers x 3 queries each)
  WORKERS.forEach((w, idx) => {
    addPattern({
      id: `att-w-${idx + 1}-1`,
      category: 'ATTENDANCE',
      intent: 'getAttendance',
      question: `${w} ki is mahine ki attendance kitni hai?`,
      variations: [`${w} attendance this month`, `${w} ne is mahine kitne din kaam kiya`, `${w} monthly hajiri summary`],
      keywords: [w.toLowerCase(), 'attendance', 'mahine', 'hajiri'],
      description: `Monthly attendance summary for ${w}`,
    });
    addPattern({
      id: `att-w-${idx + 1}-2`,
      category: 'ATTENDANCE',
      intent: 'getAttendance',
      question: `${w} kal aaya tha ya absent tha?`,
      variations: [`${w} yesterday status`, `kal ${w} present tha kya`, `${w} kal ki attendance`],
      keywords: [w.toLowerCase(), 'kal', 'status', 'yesterday'],
      description: `Yesterday presence status for ${w}`,
    });
    addPattern({
      id: `att-w-${idx + 1}-3`,
      category: 'ATTENDANCE',
      intent: 'getAttendance',
      question: `${w} ne pichhle hafte kitne half day kiye the?`,
      variations: [`${w} half days last week`, `pichhle hafte ${w} ka aadha din kitna tha`],
      keywords: [w.toLowerCase(), 'half day', 'hafte'],
      description: `Half days count for ${w}`,
    });
  });

  // Site-specific attendance (60 patterns: 12 sites x 5 queries each)
  SITES.forEach((s, idx) => {
    addPattern({
      id: `att-site-${idx + 1}-1`,
      category: 'ATTENDANCE',
      intent: 'getAttendance',
      question: `${s} par aaj kitne workers present hain?`,
      variations: [`today attendance at ${s}`, `${s} par aaj ki hajiri report`, `${s} labour turnout today`],
      keywords: [s.toLowerCase(), 'aaj', 'present', 'attendance'],
      description: `Today attendance at ${s}`,
    });
    addPattern({
      id: `att-site-${idx + 1}-2`,
      category: 'ATTENDANCE',
      intent: 'getAttendance',
      question: `${s} par kal kitne karigar kaam kar rahe the?`,
      variations: [`yesterday workers at ${s}`, `${s} kal ki attendance report`, `${s} kal ka turnout`],
      keywords: [s.toLowerCase(), 'kal', 'attendance', 'yesterday'],
      description: `Yesterday attendance at ${s}`,
    });
    addPattern({
      id: `att-site-${idx + 1}-3`,
      category: 'ATTENDANCE',
      intent: 'getAttendance',
      question: `${s} par is hafte daily average kitne labour the?`,
      variations: [`weekly average labour at ${s}`, `${s} weekly turnout average`],
      keywords: [s.toLowerCase(), 'average', 'hafta'],
      description: `Weekly average turnout at ${s}`,
    });
    addPattern({
      id: `att-site-${idx + 1}-4`,
      category: 'ATTENDANCE',
      intent: 'getAttendance',
      question: `${s} par aaj koi absent hai kya?`,
      variations: [`any absentees at ${s} today`, `${s} par aaj kiski chhutti hai`],
      keywords: [s.toLowerCase(), 'absent', 'chhutti'],
      description: `Site absentees at ${s}`,
    });
    addPattern({
      id: `att-site-${idx + 1}-5`,
      category: 'ATTENDANCE',
      intent: 'getAttendance',
      question: `${s} par is mahine ka total labour dihaadi hisaab dikhao`,
      variations: [`${s} monthly labour wages attendance`, `${s} site attendance cost this month`],
      keywords: [s.toLowerCase(), 'mahine', 'cost', 'dihaadi'],
      description: `Monthly attendance cost at ${s}`,
    });
  });

  // Date and Shift variations to reach 200 (60 patterns)
  const DATES_REL = ['Parso', 'Somvar', 'Mangalwar', 'Budhwar', 'Guruwar', 'Shukrawar', 'Shanivar', '1 tarikh', '15 tarikh', 'Pichhle somvar'];
  DATES_REL.forEach((d, idx) => {
    addPattern({
      id: `att-date-${idx + 1}-1`,
      category: 'ATTENDANCE',
      intent: 'getAttendance',
      question: `${d} ko kitne workers ne kaam kiya tha?`,
      variations: [`${d} worker turnout`, `${d} ki attendance sheet batao`],
      keywords: [d.toLowerCase(), 'attendance', 'hajiri'],
      description: `Attendance on ${d}`,
    });
    addPattern({
      id: `att-date-${idx + 1}-2`,
      category: 'ATTENDANCE',
      intent: 'getAttendance',
      question: `${d} ko total labour cost kitna bana tha?`,
      variations: [`${d} labour wages total`, `${d} attendance wage sheet`],
      keywords: [d.toLowerCase(), 'labour', 'cost', 'wages'],
      description: `Labour cost on ${d}`,
    });
    addPattern({
      id: `att-date-${idx + 1}-3`,
      category: 'ATTENDANCE',
      intent: 'getAttendance',
      question: `${d} ko half-day kis kis worker ka tha?`,
      variations: [`half days on ${d}`, `${d} ko aadha din kisne lagaya`],
      keywords: [d.toLowerCase(), 'half day'],
      description: `Half days on ${d}`,
    });
    addPattern({
      id: `att-date-${idx + 1}-4`,
      category: 'ATTENDANCE',
      intent: 'getAttendance',
      question: `${d} ko overtime shifts kisne lagayi thi?`,
      variations: [`overtime on ${d}`, `${d} ko OT kisne kiya`],
      keywords: [d.toLowerCase(), 'overtime', 'ot'],
      description: `Overtime on ${d}`,
    });
    addPattern({
      id: `att-date-${idx + 1}-5`,
      category: 'ATTENDANCE',
      intent: 'getAttendance',
      question: `${d} ko site par supervisor kaun tha?`,
      variations: [`who supervised attendance on ${d}`, `${d} ka site incharge kaun tha`],
      keywords: [d.toLowerCase(), 'supervisor', 'incharge'],
      description: `Supervisor on ${d}`,
    });
    addPattern({
      id: `att-date-${idx + 1}-6`,
      category: 'ATTENDANCE',
      intent: 'getAttendance',
      question: `${d} ko gair-hajir workers ki list dikhao`,
      variations: [`absentees on ${d}`, `${d} ko kaun nahi aaya tha`],
      keywords: [d.toLowerCase(), 'gair-hajir', 'absent'],
      description: `Absentees on ${d}`,
    });
  });

  // =========================================================================
  // 2. LABOUR WAGES & KHATA (200 patterns)
  // =========================================================================
  // General Wage queries (20)
  const generalWages = [
    { q: 'Sabhi workers ka kul baaki hisaab kitna hai?', v: ['total labour dues pending', 'labour khata baaki total', 'kitne paise majdooron ko dene baaki hain'], d: 'Total pending labour dues' },
    { q: 'Is mahine total labour cost aur wages kitna hua?', v: ['monthly payroll total', 'is mahine labour ka kul kitna bana', 'total wages this month'], d: 'Monthly payroll' },
    { q: 'Kaun se workers ko advance baaki hai?', v: ['workers with pending advance', 'peshgi baaki list', 'kiske paas advance jama hai'], d: 'Worker advance list' },
    { q: 'Pichhle mahine ka total labour cost kitna tha?', v: ['last month total wages', 'pichhle mahine majdoori kitni thi', 'last month payroll summary'], d: 'Last month payroll' },
    { q: 'Is mahine kis worker ko kitna payment diya?', v: ['worker payment list this month', 'kis labour ko kitna paisa baata', 'recent salary disbursements'], d: 'Recent worker payments' },
    { q: 'Kaun se worker ka hisaab clear / barabar ho chuka hai?', v: ['zero balance workers', 'kiska koi baaki nahi hai', 'settled worker khatas'], d: 'Settled worker khatas' },
    { q: 'Sabse zyada baaki rakam kis worker ki hai?', v: ['highest pending labour balance', 'kisko sabse zyada rupaye dene hain'], d: 'Highest wage payable' },
    { q: 'Total advance recover kitna karna bacha hai?', v: ['unrecovered worker advance', 'labour advance recovery total'], d: 'Advance recovery status' },
    { q: 'Piece-rate kaam ka is hafte total kitna bana?', v: ['sq ft labour payment total', 'piece rate work value this week'], d: 'Piece rate weekly total' },
    { q: 'Workers ko diye gaye cash payments ka report dikhao', v: ['cash salary paid to labour', 'cash payments to workers this month'], d: 'Cash wage disbursements' },
    { q: 'Online bank transfer se kis kis worker ko paisa diya?', v: ['upi payment to labour list', 'bank transfer salary history'], d: 'UPI/Bank wage history' },
    { q: 'Is hafte total kitna salary advance baata gaya?', v: ['total advance given this week', 'weekly advance payout total'], d: 'Weekly advance given' },
    { q: 'Mistri logon ka total per day dihaadi kitna banta hai?', v: ['masons daily wage total', 'mistri category total wage per day'], d: 'Mason wage total' },
    { q: 'Helper category ka total daily wage cost kitna hai?', v: ['helpers daily rate total', 'helper category dihaadi hisaab'], d: 'Helper wage total' },
    { q: 'Diwali bonus ya festival advance kis kis ko mila?', v: ['bonus given to workers', 'festival advance disbursement list'], d: 'Bonus payments' },
    { q: 'Food mess ration deduction kis worker ki salary se hua?', v: ['mess deduction in worker khata', 'ration katauti statement'], d: 'Mess wage deductions' },
    { q: 'Overtime allowance total kitna diya gaya is mahine?', v: ['total overtime wages paid', 'monthly OT allowance total'], d: 'OT allowance total' },
    { q: 'Naye join huye workers ki per-day dihaadi kya set hai?', v: ['new worker wage rates', 'new joinees salary configuration'], d: 'New worker wage rates' },
    { q: 'Weekly settlement kis kis worker ka pending hai?', v: ['pending weekly wage settlements', 'hafte ka hisaab baaki list'], d: 'Pending weekly settlement' },
    { q: 'Worker khata passbook print ya export kaise karein?', v: ['export worker ledger statement', 'worker khata download pdf'], d: 'Export worker ledger' },
  ];
  generalWages.forEach((item, idx) => {
    addPattern({
      id: `wge-gen-${idx + 1}`,
      category: 'LABOUR_WAGES',
      intent: 'getPayrollSummary',
      question: item.q,
      variations: item.v,
      keywords: ['labour', 'wages', 'khata', 'salary', 'hisaab', 'advance'],
      description: item.d,
    });
  });

  // Worker-specific khata queries (180 patterns: 20 workers x 9 queries each = 180)
  WORKERS.forEach((w, idx) => {
    addPattern({
      id: `wge-w-${idx + 1}-1`,
      category: 'LABOUR_WAGES',
      intent: 'getWorkerKhata',
      question: `${w} ka khata dikhao`,
      variations: [`${w} passbook report`, `${w} ka pura hisaab batao`, `${w} ledger sheet`],
      keywords: [w.toLowerCase(), 'khata', 'passbook', 'hisaab'],
      description: `Complete khata ledger for ${w}`,
    });
    addPattern({
      id: `wge-w-${idx + 1}-2`,
      category: 'LABOUR_WAGES',
      intent: 'getWorkerKhata',
      question: `${w} ka kitna payment baki hai?`,
      variations: [`${w} pending dues`, `${w} ko kitne paise dene baaki hain`, `${w} balance payable`],
      keywords: [w.toLowerCase(), 'baaki', 'pending', 'dues'],
      description: `Pending balance for ${w}`,
    });
    addPattern({
      id: `wge-w-${idx + 1}-3`,
      category: 'LABOUR_WAGES',
      intent: 'getWorkerKhata',
      question: `${w} ke paas kitna advance jama hai?`,
      variations: [`${w} advance balance`, `${w} ne kitna advance le rakha hai`, `${w} peshgi hisaab`],
      keywords: [w.toLowerCase(), 'advance', 'peshgi', 'jama'],
      description: `Advance balance for ${w}`,
    });
    addPattern({
      id: `wge-w-${idx + 1}-4`,
      category: 'LABOUR_WAGES',
      intent: 'getWorkerKhata',
      question: `${w} ki per day dihaadi kitni hai?`,
      variations: [`${w} daily rate`, `${w} ka rozana ka rate kya hai`, `${w} hajiri rate`],
      keywords: [w.toLowerCase(), 'dihaadi', 'rate', 'daily'],
      description: `Daily rate for ${w}`,
    });
    addPattern({
      id: `wge-w-${idx + 1}-5`,
      category: 'LABOUR_WAGES',
      intent: 'getWorkerKhata',
      question: `${w} ko is mahine total kitna payment mila?`,
      variations: [`total paid to ${w} this month`, `${w} monthly payment received`],
      keywords: [w.toLowerCase(), 'payment', 'mahine', 'mila'],
      description: `Monthly payment received by ${w}`,
    });
    addPattern({
      id: `wge-w-${idx + 1}-6`,
      category: 'LABOUR_WAGES',
      intent: 'getWorkerKhata',
      question: `${w} ko last payment kab aur kitni di thi?`,
      variations: [`last payment details for ${w}`, `${w} pichhli payment kab hui`],
      keywords: [w.toLowerCase(), 'last', 'payment', 'tarikh'],
      description: `Last payment details for ${w}`,
    });
    addPattern({
      id: `wge-w-${idx + 1}-7`,
      category: 'LABOUR_WAGES',
      intent: 'getWorkerKhata',
      question: `${w} ka is mahine ka total earned wage kitna banta hai?`,
      variations: [`${w} gross salary earned this month`, `${w} ki kamai is mahine kitni hui`],
      keywords: [w.toLowerCase(), 'earned', 'wage', 'gross'],
      description: `Total earned wages for ${w}`,
    });
    addPattern({
      id: `wge-w-${idx + 1}-8`,
      category: 'LABOUR_WAGES',
      intent: 'getWorkerKhata',
      question: `${w} ka hisaab clear hai ya baaki hai?`,
      variations: [`is ${w} account settled`, `${w} ka hisaab barabar hai kya`],
      keywords: [w.toLowerCase(), 'clear', 'settled', 'barabar'],
      description: `Account clearance status for ${w}`,
    });
    addPattern({
      id: `wge-w-${idx + 1}-9`,
      category: 'LABOUR_WAGES',
      intent: 'getWorkerKhata',
      question: `${w} ka mobile number aur bank details kya hain?`,
      variations: [`${w} contact and bank account`, `${w} ka upi ya account number`],
      keywords: [w.toLowerCase(), 'mobile', 'bank', 'upi'],
      description: `Contact and bank details for ${w}`,
    });
  });

  // =========================================================================
  // 3. PARTNER WALLET (200 patterns)
  // =========================================================================
  const generalWallets = [
    { q: 'Sabhi partners ka cash balance dikhao', v: ['all partners live wallet balance', 'partners ka cash in hand kitna hai', 'team cash overview'], d: 'All partner wallets' },
    { q: 'Team ka total cash in hand kitna hai?', v: ['total cash balance with partners', 'sabhi ka mila kar cash kitna hai', 'total company petty cash'], d: 'Total team cash' },
    { q: 'Mera current cash in hand confirm karo', v: ['my live wallet balance', 'mere paas abhi kitna cash hai', 'my cash position'], d: 'User live wallet' },
    { q: 'Site supervisors ke paas total kitna petty cash hai?', v: ['supervisor petty cash total', 'site cash in hand report'], d: 'Supervisor petty cash' },
    { q: 'Partners ke aapas ke transfers ka hisaab dikhao', v: ['inter partner fund transfers', 'partners ke beech len den'], d: 'Inter-partner transfers' },
    { q: 'Is mahine partners ne kitna drawing nikala?', v: ['partner personal drawings total', 'partners ghar kharcha withdrawal'], d: 'Partner drawings total' },
    { q: 'Bank se cash withdrawal kitna hua is hafte?', v: ['weekly bank to cash withdrawals', 'bank se kitna cash nikala gaya'], d: 'Weekly cash withdrawal' },
    { q: 'Cash in hand mein sabse zyada balance kiske paas hai?', v: ['who holds most cash right now', 'sabse zyada rokad kiske wallet mein hai'], d: 'Highest cash holder' },
    { q: 'Wallet closing hisaab status kya hai?', v: ['wallet reconciliation status', 'aaj ka wallet match hua kya'], d: 'Wallet reconciliation' },
    { q: 'Pichhle hafte partners ne total kitna paisa kharch kiya?', v: ['total partner expenses last week', 'partners weekly spend'], d: 'Partner spend last week' },
  ];
  generalWallets.forEach((item, idx) => {
    addPattern({
      id: `wal-gen-${idx + 1}`,
      category: 'PARTNER_WALLET',
      intent: 'getPartnerWallets',
      question: item.q,
      variations: item.v,
      keywords: ['wallet', 'partner', 'cash', 'rokad', 'in hand'],
      description: item.d,
    });
  });

  // Partner specific wallet queries (5 partners x 38 queries = 190 patterns)
  PARTNERS.forEach((p, pIdx) => {
    const partnerQueries = [
      `${p} ke wallet mein kitna paisa hai?`,
      `${p} ka live cash in hand kitna hai?`,
      `${p} ne aaj kitna cash spend kiya?`,
      `${p} ne kal kahan kahan paise lagaye?`,
      `${p} ne is hafte kitna paisa transfer kiya?`,
      `${p} ko is mahine company se kitna paisa mila?`,
      `${p} ne personal drawing kitna liya is mahine?`,
      `${p} ka opening cash balance kitna tha aaj subah?`,
      `${p} ka closing cash balance kya bana kal sham?`,
      `${p} ne kisi supervisor ko petty cash diya kya?`,
      `${p} ne kis worker ko kitna advance diya?`,
      `${p} ne material supplier ko kitna cash diya?`,
      `${p} ka cash passbook statement dikhao`,
      `${p} ke cash balance mein koi discrepancy aayi kya?`,
      `${p} ne bank se kitna cash nikala is mahine?`,
      `${p} ne bank mein kitna cash deposit kiya?`,
      `${p} ka net monthly cash flow statement dikhao`,
      `${p} ne diesel petrol par kitna kharch kiya?`,
      `${p} ne site mess ration par kitna lagaya?`,
      `${p} ne client se kitna cash receive kiya tha?`,
      `${p} ka last transaction kab aur kya tha?`,
      `${p} ne Vastral site ke liye kitna cash diya?`,
      `${p} ne Bopal project ke liye kitna kharch kiya?`,
      `${p} ne SG Highway site par kitna cash deliver kiya?`,
      `${p} ne Thaltej site ke labour ko kitna paisa diya?`,
      `${p} ne Sanand shed project par kitna spend kiya?`,
      `${p} ka cash in hand audit status kya hai?`,
      `${p} ko dusre partners se kitna paisa mila?`,
      `${p} ne kitna cheque deposit kiya bank mein?`,
      `${p} ne online UPI se kitne payment kiye?`,
      `${p} ka daily average expense kitna hai?`,
      `${p} ke paas kal subah kitna cash bachega?`,
      `${p} ne tools aur hardware par kitna lagaya?`,
      `${p} ka weekly settlement report dikhao`,
      `${p} ne kitne vouchers approve kiye aaj?`,
      `${p} ke physical cash count ki receipt dikhao`,
      `${p} ne tempo aur bhada kitna pay kiya?`,
      `${p} ka overall financial contribution report batao`
    ];

    partnerQueries.forEach((q, qIdx) => {
      addPattern({
        id: `wal-p-${pIdx + 1}-${qIdx + 1}`,
        category: 'PARTNER_WALLET',
        intent: 'getPartnerWallets',
        question: q,
        variations: [q.replace('kitna', 'kya'), q.replace('dikhao', 'batao')],
        keywords: [p.toLowerCase(), 'wallet', 'cash', 'balance', 'in hand'],
        description: `Wallet query for ${p}`,
      });
    });
  });

  // =========================================================================
  // 4. SITE & DAILY EXPENSES (200 patterns)
  // =========================================================================
  const generalExpenses = [
    { q: 'Aaj kitna kharcha hua?', v: ['today total expense', 'aaj ka kul kharch kitna hai', 'aaj kitne paise lage'], d: 'Today total expenses' },
    { q: 'Kal total kitna kharcha hua tha?', v: ['yesterday total expense', 'kal ka kul kharch batao'], d: 'Yesterday total expenses' },
    { q: 'Is hafte ka kul kharch kitna hai?', v: ['this week total expense', 'is hafte kitna kharcha hua'], d: 'This week expenses' },
    { q: 'Is mahine total kitna kharcha ho gaya?', v: ['this month total expense', 'is mahine ka kul kharch'], d: 'This month expenses' },
    { q: 'Pichhle mahine ka site expense kitna tha?', v: ['last month total expenses', 'pichhle mahine kul kitna kharch hua'], d: 'Last month expenses' },
    { q: 'Sabse zyada kharcha kis category mein hua?', v: ['highest expense category', 'sabse bada kharcha kahan hua'], d: 'Highest expense category' },
    { q: 'Is hafte ke petrol ke kharche dikhao', v: ['weekly petrol fuel expenses', 'petrol diesel ka kitna bill bana'], d: 'Weekly fuel expenses' },
    { q: 'Chay-nasta aur tea snacks ka kitna bill bana is mahine?', v: ['monthly tea snacks cost', 'chay nasta kharcha report'], d: 'Monthly tea & snacks' },
    { q: 'Mess ration aur grocery kharcha is mahine kitna hua?', v: ['site mess grocery expenses', 'kirana saman ka bill'], d: 'Monthly mess expenses' },
    { q: 'Tempo aur auto bhada travel expense kitna laga?', v: ['transportation tempo charges', 'gaadi bhada statement'], d: 'Transport & vehicle hire' },
    { q: 'Tools aur hardware repair ka kitna kharch hua?', v: ['tools maintenance cost', 'machine service expense'], d: 'Tools & repairs' },
    { q: 'Safety helmets boots aur gloves ka kharcha kitna tha?', v: ['safety equipment purchase cost', 'ppe kits expense'], d: 'Safety gear expenses' },
    { q: 'Site bijli bill aur water tanker ka kharch kitna aaya?', v: ['electricity and water tanker expenses', 'utilities cost on site'], d: 'Site utilities' },
    { q: 'Scaffolding aur bamboo bhada kitna chukaaya?', v: ['scaffolding rental charges', 'bhaada aur paad kharcha'], d: 'Scaffolding rent' },
    { q: 'Top 5 sabse bade kharche dikhao is mahine ke', v: ['top 5 largest expenses', 'biggest 5 expense entries'], d: 'Top 5 expenses' },
    { q: 'Aaj cash se kitna kharch hua aur UPI se kitna hua?', v: ['today cash vs upi expenses', 'payment mode wise expenses today'], d: 'Payment mode breakdown' },
    { q: 'Budget se zyada kharcha kis site par hua?', v: ['over budget sites', 'budget limit cross karne wala project'], d: 'Over-budget sites' },
    { q: 'Rozana ka average kharcha company ka kitna hai?', v: ['daily average burn rate', 'per day expense average'], d: 'Daily average burn rate' },
    { q: 'Diesel generator par is mahine kitna kharch hua?', v: ['monthly diesel for generator', 'dg set fuel expenses'], d: 'Generator fuel' },
    { q: 'Mobile recharge aur internet ka kharcha kitna laga?', v: ['mobile internet bills', 'communication expenses'], d: 'Communication expense' }
  ];
  generalExpenses.forEach((item, idx) => {
    addPattern({
      id: `exp-gen-${idx + 1}`,
      category: 'EXPENSES',
      intent: 'getExpenses',
      question: item.q,
      variations: item.v,
      keywords: ['kharch', 'kharcha', 'expense', 'petrol', 'diesel', 'chay'],
      description: item.d,
    });
  });

  // Site-wise and category combinations (180 patterns: 12 sites x 15 categories/variations = 180)
  const EXP_TYPES = [
    'petrol diesel kharcha', 'chay nasta bill', 'kirana mess ration', 'tempo bhada transport',
    'tools hardware repair', 'gas cylinder burner', 'water tanker charge', 'safety equipment',
    'scaffolding rent', 'cleaning chemical', 'total site kharcha', 'yesterday expense',
    'weekly expense', 'monthly expense', 'miscellaneous minor kharcha'
  ];

  SITES.forEach((s, sIdx) => {
    EXP_TYPES.forEach((et, etIdx) => {
      addPattern({
        id: `exp-s-${sIdx + 1}-${etIdx + 1}`,
        category: 'EXPENSES',
        intent: 'getExpenses',
        question: `${s} par ${et} kitna hua?`,
        variations: [
          `${s} ${et} report dikhao`,
          `${s} par ${et} ka hisaab batao`,
          `show ${et} for ${s}`
        ],
        keywords: [s.toLowerCase(), ...et.split(' ')],
        description: `${et} at ${s}`,
      });
    });
  });

  // =========================================================================
  // 5. SUPPLIERS & PURCHASES (200 patterns)
  // =========================================================================
  const generalSuppliers = [
    { q: 'Kis supplier ka kitna baaki hai?', v: ['supplier balances list', 'sabhi suppliers ka baaki hisaab', 'total supplier dues'], d: 'All supplier balances' },
    { q: 'Total supplier outstanding balance kitna hai?', v: ['total unpaid supplier bills', 'dues payable to vendors'], d: 'Total outstanding supplier balance' },
    { q: 'Is mahine total material purchase kitni hui?', v: ['total procurement this month', 'is mahine kitna maal kharida'], d: 'Monthly purchases total' },
    { q: 'Suppliers ko is mahine kitna payment diya gaya?', v: ['supplier payment disbursements this month', 'vendors paid this month'], d: 'Monthly vendor payments' },
    { q: 'GST bill purchase vs raw parchi purchase kitni hai?', v: ['gst bills vs cash parchi ratio', 'tax invoice purchases total'], d: 'GST vs Cash bills' },
    { q: 'Sabse zyada baaki rakam kis vendor ki hai?', v: ['highest pending supplier balance', 'kisko sabse zyada payment deni hai'], d: 'Highest supplier balance' },
    { q: 'Kaun se supplier ka hisaab pura chukta ho gaya?', v: ['settled supplier accounts', 'zero balance vendor list'], d: 'Settled vendor accounts' },
    { q: 'Pichhle hafte kis supplier se maal purchase kiya tha?', v: ['vendors purchased from last week', 'recent supplier goods receipts'], d: 'Recent vendor purchases' },
    { q: 'Cheque se kis kis supplier ko payment ki gayi?', v: ['cheque payments to suppliers', 'vendor payments by cheque'], d: 'Cheque payments' },
    { q: 'RTGS aur NEFT se kitna payment bheja suppliers ko?', v: ['online bank payments to vendors', 'rtgs neft supplier summary'], d: 'RTGS payments' },
    { q: 'Advance payment kis supplier ko diya hua hai?', v: ['advance paid to vendors', 'supplier advance ledger'], d: 'Vendor advance list' },
    { q: 'Dr Fixit chemicals ka main supplier kaun hai?', v: ['primary waterproofing distributor', 'authorized dr fixit dealer'], d: 'Primary chemical dealer' },
    { q: 'Cement ka regular supplier kaun hai aur rate kya hai?', v: ['cement supplier and per bag rate', 'cement dealer contact'], d: 'Cement dealer details' },
    { q: 'Overdue supplier bills kaun kaun se hain?', v: ['bills crossed credit period', '30 din se zyada pending bills'], d: 'Overdue vendor bills' },
    { q: 'Pending material deliveries kaun kaun si hain?', v: ['ordered goods not delivered yet', 'pending purchase challans'], d: 'Pending material delivery' },
    { q: 'Vendor ledger statement PDF kaise export karein?', v: ['download supplier ledger', 'vendor statement print'], d: 'Export vendor ledger' },
    { q: 'Discount ya rebate kis supplier ne diya is mahine?', v: ['supplier cash discount received', 'vendor discount ledger'], d: 'Vendor discount received' },
    { q: 'Material return ya credit note kis supplier ka bana?', v: ['goods return credit notes', 'material rejection ledger'], d: 'Credit notes & returns' },
    { q: 'Transport damage deduction kis vendor ke bill se hua?', v: ['damage deduction in supplier bill', 'shortage recovery'], d: 'Damage deductions' },
    { q: 'Local hardware store ki monthly udhari kitni hai?', v: ['local hardware shop pending khata', 'petty purchase bills total'], d: 'Local hardware balance' },
  ];
  generalSuppliers.forEach((item, idx) => {
    addPattern({
      id: `sup-gen-${idx + 1}`,
      category: 'SUPPLIERS',
      intent: 'getSupplierBalances',
      question: item.q,
      variations: item.v,
      keywords: ['supplier', 'vendor', 'purchase', 'bill', 'baaki', 'maal'],
      description: item.d,
    });
  });

  // Supplier-specific queries (10 suppliers x 18 queries = 180 patterns)
  SUPPLIERS.forEach((sup, sIdx) => {
    const supQueries = [
      `${sup} ka kitna balance baaki hai?`,
      `${sup} ka pura ledger statement dikhao`,
      `${sup} ko is mahine kitna payment diya?`,
      `${sup} se last purchase kab hui thi aur kitne ki?`,
      `${sup} ka GST number aur billing address kya hai?`,
      `${sup} ke pending bills ki list dikhao`,
      `${sup} ko last cheque kab diya tha?`,
      `${sup} ka payment term aur credit days kitne hain?`,
      `${sup} se pichhle mahine kitna maal kharida tha?`,
      `${sup} ka hisaab clear hai ya baaki hai?`,
      `${sup} ko advance diya hai kya koi?`,
      `${sup} ke material purchase rates kya lagte hain?`,
      `${sup} se Cement ya Chemical ke kitne challan aaye?`,
      `${sup} ko online NEFT / RTGS kitna kiya?`,
      `${sup} ka contact person aur mobile number kya hai?`,
      `${sup} ke bills par kitna GST input tax credit bana?`,
      `${sup} ne koi cash discount offer kiya kya?`,
      `${sup} se total yearly purchase volume kitna hua?`
    ];

    supQueries.forEach((q, qIdx) => {
      addPattern({
        id: `sup-s-${sIdx + 1}-${qIdx + 1}`,
        category: 'SUPPLIERS',
        intent: 'getSupplierBalances',
        question: q,
        variations: [q.replace('kitna', 'kya'), q.replace('dikhao', 'batao')],
        keywords: [sup.toLowerCase(), 'supplier', 'balance', 'purchase', 'hisaab'],
        description: `Supplier query for ${sup}`,
      });
    });
  });

  // =========================================================================
  // 6. MATERIALS & STOCK (200 patterns)
  // =========================================================================
  const generalStock = [
    { q: 'Godown mein kaun sa material low stock par hai?', v: ['low stock alert in godown', 'materials running out soon', 'reorder level materials'], d: 'Low stock materials' },
    { q: 'Waterproofing chemicals ka total stock value kitna hai?', v: ['total godown inventory valuation', 'chemicals stock value in rupees'], d: 'Inventory valuation' },
    { q: 'Pichhle hafte total kitna cement use hua sites par?', v: ['weekly cement consumption across sites', 'cement bags used last week'], d: 'Weekly cement usage' },
    { q: 'APP membrane ke kitne roll godown mein bache hain?', v: ['app membrane rolls available', 'membrane roll stock count'], d: 'APP membrane stock' },
    { q: 'Site par bacha hua unused material wapas godown kab aaya?', v: ['material return to godown', 'site return challan status'], d: 'Site return stock' },
    { q: 'Inter-site material transfer challan kitne pending hain?', v: ['pending site to site transfers', 'internal material dispatch status'], d: 'Pending transfer challans' },
    { q: 'Waterproofing application tools aur brushes ka stock kitna hai?', v: ['rollers and brushes inventory', 'application tools available'], d: 'Tools inventory' },
    { q: 'Cement expiry date ya purana stock koi bacha hai kya?', v: ['old cement bags in godown', 'cement stock age report'], d: 'Aged cement stock' },
    { q: 'Total chemical drums kitne hain godown mein?', v: ['liquid chemical drums count', 'total chemical inventory'], d: 'Total chemical drums' },
    { q: 'Material consumption report is mahine ka dikhao', v: ['monthly material consumption statement', 'maal kitna use hua report'], d: 'Monthly consumption' },
  ];
  generalStock.forEach((item, idx) => {
    addPattern({
      id: `mat-gen-${idx + 1}`,
      category: 'MATERIALS_STOCK',
      intent: 'getMaterialStock',
      question: item.q,
      variations: item.v,
      keywords: ['material', 'stock', 'godown', 'chemical', 'cement', 'bacha'],
      description: item.d,
    });
  });

  // Material-specific stock & consumption (12 materials x 15 queries = 180 patterns)
  MATERIALS.forEach((mat, mIdx) => {
    const matQueries = [
      `${mat} ka stock kitna bacha hai?`,
      `${mat} ke kitne drum ya bag godown mein hain?`,
      `${mat} ka purchase rate last time kya laga tha?`,
      `${mat} Vastral site par kitna deliver hua?`,
      `${mat} Bopal project par kitna use ho gaya?`,
      `${mat} SG Highway site par kitna bacha hua hai?`,
      `${mat} Thaltej site par kab bheja gaya tha?`,
      `${mat} Sanand shed project par kitna laga?`,
      `${mat} ka naya order kab dena padega?`,
      `${mat} low stock level par hai kya?`,
      `${mat} ka total monthly consumption kitna raha?`,
      `${mat} kis supplier se kharida gaya tha?`,
      `${mat} ka batch number aur expiry date kya hai?`,
      `${mat} per sq.ft application coverage kitna deta hai?`,
      `${mat} ka physical stock verify hua kya godown mein?`
    ];

    matQueries.forEach((q, qIdx) => {
      addPattern({
        id: `mat-m-${mIdx + 1}-${qIdx + 1}`,
        category: 'MATERIALS_STOCK',
        intent: 'getMaterialStock',
        question: q,
        variations: [q.replace('kitna', 'kya'), q.replace('batao', 'dikhao')],
        keywords: [mat.toLowerCase(), 'stock', 'material', 'godown', 'usage'],
        description: `Material query for ${mat}`,
      });
    });
  });

  // Additional 10 stock patterns to round to 200
  for (let i = 1; i <= 10; i++) {
    addPattern({
      id: `mat-extra-${i}`,
      category: 'MATERIALS_STOCK',
      intent: 'getMaterialStock',
      question: `Godown section ${i} mein waterproofing material stock audit report dikhao`,
      variations: [`section ${i} stock verification`, `godown rack ${i} material details`],
      keywords: ['godown', 'section', 'stock', 'audit'],
      description: `Stock audit for section ${i}`,
    });
  }

  // =========================================================================
  // 7. PROJECTS & CLIENTS (200 patterns)
  // =========================================================================
  const generalProjects = [
    { q: 'Sabhi running projects ki list aur status dikhao', v: ['active projects overview', 'kaun kaun se sites chalu hain', 'running sites summary'], d: 'All active projects' },
    { q: 'Clients se total pending receivable kitna baaki hai?', v: ['total pending money in from clients', 'client baaki payment total', 'overdue client bills'], d: 'Total client receivables' },
    { q: 'Is mahine total client payment kitni receive hui?', v: ['monthly client receipts total', 'clients se aaya hua kul paisa'], d: 'Monthly client receipts' },
    { q: 'Sabse zyada munafa / profit margin kis project mein hai?', v: ['most profitable site', 'highest margin project'], d: 'Most profitable project' },
    { q: 'Kaun sa project budget limit cross kar chuka hai?', v: ['over budget projects', 'kis site par estimation se zyada kharcha hua'], d: 'Over-budget projects' },
    { q: 'Total complete huye projects ka profit loss statement', v: ['completed projects p&l', 'khatam hui sites ka munafa hisaab'], d: 'Completed projects P&L' },
    { q: 'Running bills aur stage-wise payment status dikhao', v: ['stage payment milestones', 'running ra bills summary'], d: 'Milestone billing status' },
    { q: 'Waterproofing area in sq.ft total kitna execute hua?', v: ['total square feet completed this month', 'executed area report'], d: 'Executed sq.ft total' },
    { q: 'Kaun se client ne 60 din se payment nahi ki?', v: ['long overdue clients', 'defaulting client bills list'], d: 'Long overdue clients' },
    { q: 'Client quotation aur approved contract copies kahan hain?', v: ['view project quotations', 'client work orders'], d: 'Project work orders' },
  ];
  generalProjects.forEach((item, idx) => {
    addPattern({
      id: `prj-gen-${idx + 1}`,
      category: 'PROJECTS_CLIENTS',
      intent: 'getProjectSummary',
      question: item.q,
      variations: item.v,
      keywords: ['project', 'site', 'client', 'payment', 'profit', 'contract'],
      description: item.d,
    });
  });

  // Site-specific financial & operational queries (12 sites x 15 queries = 180 patterns)
  SITES.forEach((site, sIdx) => {
    const siteQueries = [
      `${site} ka total kharcha aur payment received kitna hai?`,
      `${site} ka profit and loss statement dikhao`,
      `${site} par client se kitna paisa lena baaki hai?`,
      `${site} ka total contract quotation value kitna tha?`,
      `${site} par labour cost ab tak kitna aa chuka hai?`,
      `${site} par material cost ab tak kitna laga?`,
      `${site} par running site expenses kitne ho chuke hain?`,
      `${site} ka work completion percentage kitna hai?`,
      `${site} ka client kaun hai aur contact details kya hain?`,
      `${site} par last client payment kab aayi thi?`,
      `${site} par next billing stage milestone kab aayega?`,
      `${site} par per sq.ft execution cost kitni pad rahi hai?`,
      `${site} par supervisor incharge kaun hai?`,
      `${site} ka safety compliance aur inspection report kya hai?`,
      `${site} par retention money kitna hold par hai?`
    ];

    siteQueries.forEach((q, qIdx) => {
      addPattern({
        id: `prj-s-${sIdx + 1}-${qIdx + 1}`,
        category: 'PROJECTS_CLIENTS',
        intent: 'getProjectSummary',
        question: q,
        variations: [q.replace('kitna', 'kya'), q.replace('dikhao', 'batao')],
        keywords: [site.toLowerCase(), 'project', 'client', 'cost', 'profit', 'hisaab'],
        description: `Project details for ${site}`,
      });
    });
  });

  // Additional 10 project patterns to reach 200
  for (let i = 1; i <= 10; i++) {
    addPattern({
      id: `prj-extra-${i}`,
      category: 'PROJECTS_CLIENTS',
      intent: 'getProjectSummary',
      question: `Commercial project phase ${i} ka final billing hisaab dikhao`,
      variations: [`phase ${i} project billing`, `phase ${i} client settlement statement`],
      keywords: ['project', 'phase', 'billing', 'settlement'],
      description: `Project phase ${i} billing`,
    });
  }

  // =========================================================================
  // 8. DAY CLOSING & BANKING (200 patterns)
  // =========================================================================
  const generalClosing = [
    { q: 'Din ka hisaab verify kaise karein?', v: ['how to do daily day closing', 'sham ka hisaab verify karne ka tarika', 'day closing workflow'], d: 'Day closing workflow' },
    { q: 'Aaj ka din close hua ya abhi pending hai?', v: ['today day closing status', 'aaj ka hisaab lock hua kya', 'is today closed'], d: 'Today closing status' },
    { q: 'Kal ka din kisne aur kitne baje lock kiya tha?', v: ['who verified yesterday closing', 'yesterday day lock audit'], d: 'Yesterday day lock audit' },
    { q: 'Cash in hand aur physical cash match ho raha hai kya?', v: ['physical cash vs system cash match', 'cash book balance tally status'], d: 'Cash tally check' },
    { q: 'Physical cash count mein kitna farak / discrepancy aayi?', v: ['cash difference surplus shortage', 'sham ke cash mein farak kitna hai'], d: 'Cash discrepancy' },
    { q: 'Cash in hand aur bank balance kitna hai?', v: ['total liquid funds available', 'overall money position report', 'bank and cash summary'], d: 'Money position' },
    { q: 'Total liquid money position company ki kitni hai?', v: ['total cash and bank liquidity', 'instant usable company funds'], d: 'Company liquid funds' },
    { q: 'Kal subah site expenses ke liye kitna cash ready hai?', v: ['available cash for tomorrow sites', 'ready cash reserve'], d: 'Opening cash reserve' },
    { q: 'Day-lock lagne ke baad koi nayi entry edit ho sakti hai kya?', v: ['can locked day be edited', 'locked day policy'], d: 'Day lock edit rules' },
    { q: 'Cash Book daily summary report download kaise karein?', v: ['export daily cash flow statement', 'din ka hisaab pdf download'], d: 'Cash book download' },
  ];
  generalClosing.forEach((item, idx) => {
    addPattern({
      id: `cls-gen-${idx + 1}`,
      category: 'DAY_CLOSING',
      intent: 'getCashBookSummary',
      question: item.q,
      variations: item.v,
      keywords: ['closing', 'hisaab', 'lock', 'cash in hand', 'farak', 'discrepancy'],
      description: item.d,
    });
  });

  // Bank-specific & Daily Closing date combinations (4 banks x 45 queries = 180 patterns)
  BANKS.forEach((bank, bIdx) => {
    const bankQueries = [
      `${bank} ka live balance kitna hai?`,
      `${bank} account statement is hafte ka dikhao`,
      `${bank} se is mahine total kitna withdrawal hua?`,
      `${bank} mein client payments total kitni deposit hui?`,
      `${bank} ka opening balance kya tha is mahine?`,
      `${bank} se suppliers ko kitna online transfer kiya?`,
      `${bank} se cash nikalne ki last entry kya thi?`,
      `${bank} account mein koi bounce cheque entry hai kya?`,
      `${bank} ka bank reconciliation statement status kya hai?`,
      `${bank} mein minimum balance maintain ho raha hai kya?`,
      `${bank} se partner drawing kitna transfer hua?`,
      `${bank} ka OD / Cash Credit limit kitna use hua?`,
      `${bank} par bank charges aur interest kitna laga?`,
      `${bank} se GST payment kitna chukaaya?`,
      `${bank} account number aur IFSC code kya hai?`,
      `${bank} ka passbook statement export karo`,
      `${bank} mein cash deposit slip confirmation dikhao`,
      `${bank} se RTGS transfer limit kitni bachi hai?`,
      `${bank} mein aayi hui unverified receipts kitni hain?`,
      `${bank} ka monthly cash inflow vs outflow kya raha?`,
      `${bank} se salary direct transfer kis kis ko hui?`,
      `${bank} account mein kal subah kitna balance aane wala hai?`,
      `${bank} statement aur system transactions match hain kya?`,
      `${bank} mein cheque clearance status kya hai?`,
      `${bank} se Petty Cash wallet mein kitna bheja gaya?`,
      `${bank} ka last 5 transactions summary dikhao`,
      `${bank} se electricity bill auto-debit kitna hua?`,
      `${bank} par fixed deposit ya security guarantee kitni hai?`,
      `${bank} ka account type current hai ya cash-credit?`,
      `${bank} account balance audit report dikhao`,
      `${bank} mein cash shortage par auto-alert hai kya?`,
      `${bank} se Vastral project ka material bill kitna gaya?`,
      `${bank} se Bopal project ki client payment kab aayi?`,
      `${bank} se Asian Paints ko kitna payment transfer hua?`,
      `${bank} se Pidilite ko last payment kab hui thi?`,
      `${bank} account ke authorized signatories kaun hain?`,
      `${bank} statement mein unknown debit entry hai kya koi?`,
      `${bank} se TDS aur tax payment kitni hui?`,
      `${bank} ka net interest earned kitna bana?`,
      `${bank} mein credit card bill settlement kitna hua?`,
      `${bank} se vendor advances kitne transfer huye?`,
      `${bank} ka daily closing time kya rehta hai?`,
      `${bank} transaction report Excel export kaise karein?`,
      `${bank} se partner loan repayment entry dikhao`,
      `${bank} account summary total dashboard par update hai kya?`
    ];

    bankQueries.forEach((q, qIdx) => {
      addPattern({
        id: `cls-b-${bIdx + 1}-${qIdx + 1}`,
        category: 'DAY_CLOSING',
        intent: 'getCashBookSummary',
        question: q,
        variations: [q.replace('kitna', 'kya'), q.replace('dikhao', 'batao')],
        keywords: [bank.toLowerCase(), 'bank', 'balance', 'account', 'statement'],
        description: `Bank query for ${bank}`,
      });
    });
  });

  // Additional 10 closing patterns to reach 200
  for (let i = 1; i <= 10; i++) {
    addPattern({
      id: `cls-extra-${i}`,
      category: 'DAY_CLOSING',
      intent: 'getCashBookSummary',
      question: `Pichhle hafte ke din ${i} ka physical cash verification audit dikhao`,
      variations: [`day ${i} cash audit`, `day ${i} discrepancy statement`],
      keywords: ['cash', 'audit', 'verification', 'discrepancy'],
      description: `Cash audit for day ${i}`,
    });
  }

  // =========================================================================
  // 9. 1-CLICK ACTION DRAFTS (200 patterns)
  // =========================================================================
  // Action drafts must be strictly drafts (never execute without user confirmation)
  // Expense Drafts (40)
  const DRAFT_AMOUNTS = ['100', '150', '200', '250', '300', '400', '500', '600', '800', '1000', '1200', '1500', '2000', '2500', '3000', '5000', '10000', '15000', '20000', '50000'];

  DRAFT_AMOUNTS.forEach((amt, idx) => {
    addPattern({
      id: `drf-exp-${idx + 1}-1`,
      category: 'ACTION_DRAFTS',
      intent: 'draftExpense',
      question: `Site petrol ka ₹${amt} kharch add karo`,
      variations: [`petrol expense ₹${amt} likho`, `₹${amt} petrol ka kharcha dalo`, `record fuel expense of ${amt}`],
      keywords: ['petrol', amt, 'kharch', 'add', 'likho'],
      description: `Draft petrol expense of ₹${amt}`,
      isActionDraft: true,
    });
    addPattern({
      id: `drf-exp-${idx + 1}-2`,
      category: 'ACTION_DRAFTS',
      intent: 'draftExpense',
      question: `Site chay nasta ₹${amt} kharcha likho`,
      variations: [`chay snacks ₹${amt} add karo`, `tea nasta expense ₹${amt} likh lo`],
      keywords: ['chay', 'nasta', amt, 'kharcha', 'likho'],
      description: `Draft tea & snacks expense of ₹${amt}`,
      isActionDraft: true,
    });
  });

  // Worker Advance Drafts (40: 20 workers x 2 amount variants)
  WORKERS.forEach((w, idx) => {
    addPattern({
      id: `drf-adv-${idx + 1}-1`,
      category: 'ACTION_DRAFTS',
      intent: 'draftWorkerAdvance',
      question: `${w} ko 500 rupaye advance do`,
      variations: [`${w} ko ₹500 advance likho`, `give ₹500 advance to ${w}`, `advance draft for ${w} 500`],
      keywords: [w.toLowerCase(), '500', 'advance', 'do', 'likho'],
      description: `Draft advance of ₹500 for ${w}`,
      isActionDraft: true,
    });
    addPattern({
      id: `drf-adv-${idx + 1}-2`,
      category: 'ACTION_DRAFTS',
      intent: 'draftWorkerAdvance',
      question: `${w} ko 1000 rupaye advance likho`,
      variations: [`${w} advance 1000 draft karo`, `record 1000 advance to ${w}`],
      keywords: [w.toLowerCase(), '1000', 'advance', 'likho'],
      description: `Draft advance of ₹1,000 for ${w}`,
      isActionDraft: true,
    });
  });

  // Partner Fund Transfer Drafts (40: combinations of partners)
  let pTransferCount = 0;
  for (let i = 0; i < PARTNERS.length; i++) {
    for (let j = 0; j < PARTNERS.length; j++) {
      if (i !== j && pTransferCount < 40) {
        pTransferCount++;
        const pFrom = PARTNERS[i];
        const pTo = PARTNERS[j];
        addPattern({
          id: `drf-trf-${pTransferCount}`,
          category: 'ACTION_DRAFTS',
          intent: 'draftFundTransfer',
          question: `${pFrom} ne ${pTo} ko 5000 rupaye transfer kiye likho`,
          variations: [`transfer 5000 from ${pFrom} to ${pTo}`, `${pFrom} to ${pTo} 5000 cash transfer draft`],
          keywords: [pFrom.toLowerCase(), pTo.toLowerCase(), 'transfer', '5000', 'likho'],
          description: `Draft transfer from ${pFrom} to ${pTo}`,
          isActionDraft: true,
        });
      }
    }
  }

  // Material Purchase Drafts (40: combinations of suppliers & items)
  SUPPLIERS.forEach((sup, sIdx) => {
    addPattern({
      id: `drf-pur-${sIdx + 1}-1`,
      category: 'ACTION_DRAFTS',
      intent: 'draftGoodsPurchase',
      question: `${sup} se 20 bag cement kharida entry likho`,
      variations: [`record purchase of 20 cement bags from ${sup}`, `${sup} cement purchase 20 bags draft`],
      keywords: [sup.toLowerCase(), 'cement', 'purchase', 'entry', 'kharida'],
      description: `Draft cement purchase from ${sup}`,
      isActionDraft: true,
    });
    addPattern({
      id: `drf-pur-${sIdx + 1}-2`,
      category: 'ACTION_DRAFTS',
      intent: 'draftGoodsPurchase',
      question: `${sup} se 5 drum waterproofing chemical purchase add karo`,
      variations: [`5 chemical drums purchase from ${sup}`, `record 5 drums chemical from ${sup}`],
      keywords: [sup.toLowerCase(), 'chemical', 'purchase', 'add'],
      description: `Draft chemical purchase from ${sup}`,
      isActionDraft: true,
    });
    addPattern({
      id: `drf-pur-${sIdx + 1}-3`,
      category: 'ACTION_DRAFTS',
      intent: 'draftGoodsPurchase',
      question: `${sup} se 10 roll APP membrane purchase draft banao`,
      variations: [`10 membrane rolls from ${sup}`, `record purchase 10 membrane rolls ${sup}`],
      keywords: [sup.toLowerCase(), 'membrane', 'purchase', 'draft'],
      description: `Draft membrane purchase from ${sup}`,
      isActionDraft: true,
    });
    addPattern({
      id: `drf-pur-${sIdx + 1}-4`,
      category: 'ACTION_DRAFTS',
      intent: 'draftGoodsPurchase',
      question: `${sup} ko 10000 payment entry record karo`,
      variations: [`pay 10000 to ${sup} draft`, `record vendor payment 10000 to ${sup}`],
      keywords: [sup.toLowerCase(), '10000', 'payment', 'record'],
      description: `Draft payment to ${sup}`,
      isActionDraft: true,
    });
  });

  // Client Money In Drafts & Attendance Drafts to reach 200 (40 patterns)
  SITES.forEach((site, sIdx) => {
    addPattern({
      id: `drf-rec-${sIdx + 1}-1`,
      category: 'ACTION_DRAFTS',
      intent: 'draftClientPayment',
      question: `${site} client se 50000 cash payment mila likho`,
      variations: [`record 50000 client payment for ${site}`, `receive 50000 cash from ${site} client`],
      keywords: [site.toLowerCase(), '50000', 'client', 'payment', 'mila'],
      description: `Draft client payment for ${site}`,
      isActionDraft: true,
    });
    addPattern({
      id: `drf-rec-${sIdx + 1}-2`,
      category: 'ACTION_DRAFTS',
      intent: 'draftClientPayment',
      question: `${site} client se 25000 UPI mila entry karo`,
      variations: [`record 25000 upi client payment ${site}`, `receive 25000 upi from ${site}`],
      keywords: [site.toLowerCase(), '25000', 'upi', 'client', 'entry'],
      description: `Draft UPI receipt for ${site}`,
      isActionDraft: true,
    });
    addPattern({
      id: `drf-att-${sIdx + 1}-1`,
      category: 'ACTION_DRAFTS',
      intent: 'draftAttendance',
      question: `${site} par aaj 5 mistri aur 8 helper present mark karo`,
      variations: [`mark attendance at ${site} 5 masons 8 helpers`, `record attendance for ${site}`],
      keywords: [site.toLowerCase(), 'present', 'attendance', 'mark'],
      description: `Draft attendance for ${site}`,
      isActionDraft: true,
    });
  });

  // Extra action drafts to reach exactly 200
  while (patterns.filter((p) => p.category === 'ACTION_DRAFTS').length < 200) {
    const cur = patterns.filter((p) => p.category === 'ACTION_DRAFTS').length + 1;
    addPattern({
      id: `drf-extra-${cur}`,
      category: 'ACTION_DRAFTS',
      intent: 'draftExpense',
      question: `Site repair ka ₹${cur * 100} kharch voucher draft banao`,
      variations: [`draft repair expense voucher ₹${cur * 100}`, `record maintenance cost ₹${cur * 100}`],
      keywords: ['repair', `${cur * 100}`, 'voucher', 'draft'],
      description: `Draft repair expense of ₹${cur * 100}`,
      isActionDraft: true,
    });
  }

  // =========================================================================
  // 10. SYSTEM GUIDES & HOW-TO (200 patterns)
  // =========================================================================
  const GUIDE_TOPICS = [
    { id: 'money_in', title: 'Client Payment Receive Karna', keywords: ['money in', 'receive payment', 'client cash', 'bill payment'] },
    { id: 'give_money', title: 'Fund Transfer Aur Advance Dena', keywords: ['give money', 'fund transfer', 'advance dena', 'payout'] },
    { id: 'daily_expense', title: 'Daily Site Expense Record Karna', keywords: ['daily expense', 'kharcha likhna', 'site petrol', 'chay nasta'] },
    { id: 'goods_purchase', title: 'Material Purchase Entry Karna', keywords: ['goods purchase', 'maal kharidna', 'bill entry', 'stock in'] },
    { id: 'worker_khata', title: 'Worker Khata Aur Passbook Chalana', keywords: ['worker khata', 'passbook', 'hisaab', 'labour ledger'] },
    { id: 'daily_closing', title: 'Din Ka Hisaab Aur Day Closing Lock', keywords: ['day closing', 'sham ka hisaab', 'cash lock', 'verify'] },
    { id: 'attendance', title: 'Daily Attendance Sheet Bharna', keywords: ['attendance', 'hajiri sheet', 'present absent', 'overtime'] },
    { id: 'work_record', title: 'Piece-Rate Aur Work Record Entry', keywords: ['work record', 'piece rate', 'measurement', 'sq ft'] },
    { id: 'salary', title: 'Weekly Aur Monthly Salary Bananna', keywords: ['salary slip', 'monthly wages', 'payroll', 'settlement'] },
    { id: 'custom_reasons', title: 'Naya Expense Reason Add Karna', keywords: ['custom reasons', 'naya category', 'reason create'] },
    { id: 'reports', title: 'Financial Aur Site Reports Download Karna', keywords: ['reports', 'pdf download', 'excel export', 'statement'] },
    { id: 'material_transfer', title: 'Site Se Site Maal Transfer Challan', keywords: ['material transfer', 'challan', 'site dispatch'] },
    { id: 'bank_reconciliation', title: 'Bank Accounts Match Aur Reconcile Karna', keywords: ['bank reconcile', 'passbook match', 'online statements'] },
    { id: 'user_roles', title: 'Supervisor Aur Partner Permissions Set Karna', keywords: ['user roles', 'permissions', 'supervisor access'] },
    { id: 'mobile_app_guide', title: 'Mobile Home Screen Par App Add Karna (PWA)', keywords: ['mobile install', 'pwa add to home', 'app shortcut'] },
  ];

  GUIDE_TOPICS.forEach((gt, gtIdx) => {
    for (let qNum = 1; qNum <= 13; qNum++) {
      const qVariants = [
        `${gt.title} kaise karein?`,
        `${gt.title} ka step by step tarika batao`,
        `${gt.title} karne ke liye screen par kahan jana hota hai?`,
        `${gt.title} mein koi galti ho jaye to edit kaise karein?`,
        `${gt.title} ka print ya pdf report kaise nikalein?`,
        `${gt.title} mobile se kaise operate hota hai?`,
        `${gt.title} ke liye permissions kis kis ke paas hain?`,
        `${gt.title} mein delete ya cancel option kahan hota hai?`,
        `${gt.title} ka shortcut button kahan milta hai?`,
        `${gt.title} ke rules aur guidelines kya hain?`,
        `${gt.title} karte samay kya dhyan rakhna chahiye?`,
        `${gt.title} ka status dashboard par kahan dikhta hai?`,
        `${gt.title} se related history kahan check hoti hai?`
      ];

      const chosenQ = qVariants[qNum - 1] || `${gt.title} guide ${qNum}`;
      addPattern({
        id: `gui-${gtIdx + 1}-${qNum}`,
        category: 'SYSTEM_GUIDES',
        intent: `knowledge_base:${gt.id}`,
        question: chosenQ,
        variations: [chosenQ.replace('kaise karein', 'ka process kya hai'), chosenQ.replace('batao', 'samjhao')],
        keywords: [...gt.keywords, 'guide', 'kaise', 'tarika'],
        description: `How to guide: ${gt.title} (Step ${qNum})`,
      });
    }
  });

  // Extra guides to reach exactly 200
  while (patterns.filter((p) => p.category === 'SYSTEM_GUIDES').length < 200) {
    const cur = patterns.filter((p) => p.category === 'SYSTEM_GUIDES').length + 1;
    addPattern({
      id: `gui-extra-${cur}`,
      category: 'SYSTEM_GUIDES',
      intent: 'knowledge_base:reports',
      question: `App feature guide number ${cur} ka pura documentation dikhao`,
      variations: [`feature guide ${cur}`, `system instructions ${cur}`],
      keywords: ['guide', 'feature', 'help', 'instructions'],
      description: `System guide documentation #${cur}`,
    });
  }

  return patterns;
}

const allPatterns = buildPatterns();
console.log('Generated patterns count:', allPatterns.length);

const categoryCounts: Record<string, number> = {};
for (const p of allPatterns) {
  categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
}
console.log('Category Counts:', categoryCounts);

// Write JSON data file
const jsonPath = path.join(process.cwd(), 'src', 'lib', 'ai', 'question-patterns-bank.json');
fs.writeFileSync(jsonPath, JSON.stringify(allPatterns, null, 2), 'utf-8');
console.log('Successfully wrote', allPatterns.length, 'patterns to JSON:', jsonPath);

// Generate TypeScript source code importing JSON
let tsContent = `import rawPatternsBank from './question-patterns-bank.json';

export type QuestionCategory =
  | 'ATTENDANCE'
  | 'LABOUR_WAGES'
  | 'PARTNER_WALLET'
  | 'EXPENSES'
  | 'SUPPLIERS'
  | 'MATERIALS_STOCK'
  | 'PROJECTS_CLIENTS'
  | 'DAY_CLOSING'
  | 'ACTION_DRAFTS'
  | 'SYSTEM_GUIDES';

export interface QuestionPattern {
  id: string;
  category: QuestionCategory;
  intent: string;
  question: string;
  variations: string[];
  keywords: string[];
  description: string;
  isActionDraft?: boolean;
}

export const QUESTION_CATEGORIES: { id: QuestionCategory; label: string; icon: string; description: string }[] = [
  { id: 'ATTENDANCE', label: 'Attendance & Hajiri', icon: '📋', description: 'Daily attendance, present/absent count, half-days, overtime shifts' },
  { id: 'LABOUR_WAGES', label: 'Labour Wages & Khata', icon: '👷', description: 'Worker khata, pending wages, daily rate, advance recovery, piece-rate' },
  { id: 'PARTNER_WALLET', label: 'Partner Cash & Wallets', icon: '🤝', description: 'Partner cash in hand, wallet balance, bank transfers, team cash' },
  { id: 'EXPENSES', label: 'Site & Daily Expenses', icon: '💰', description: 'Daily site kharcha, petrol, diesel, chay-nasta, mess, machine repairs' },
  { id: 'SUPPLIERS', label: 'Suppliers & Purchases', icon: '📦', description: 'Supplier ledger, pending bills, purchase entries, GST rates, supplier advance' },
  { id: 'MATERIALS_STOCK', label: 'Materials & Stock', icon: '🏗️', description: 'Chemicals, cement, Dr Fixit, APP membrane, godown stock, consumption' },
  { id: 'PROJECTS_CLIENTS', label: 'Projects & Clients', icon: '🏢', description: 'Project costing, client receipts, pending bills, contract values, profit' },
  { id: 'DAY_CLOSING', label: 'Day Closing & Banking', icon: '🔒', description: 'Cash verification, daily closing status, bank accounts, liquid money' },
  { id: 'ACTION_DRAFTS', label: '1-Click Action Drafts', icon: '⚡', description: 'Instant draft creation for expenses, advances, purchases, attendance' },
  { id: 'SYSTEM_GUIDES', label: 'How-To Guides & Help', icon: '💡', description: 'App usage, step-by-step instructions, bill creation, settings' },
];

export const QUESTION_PATTERNS_BANK: QuestionPattern[] = rawPatternsBank as QuestionPattern[];

export function searchQuestionPatterns(
  query: string,
  limit: number = 20
): QuestionPattern[] {
  const q = query.trim().toLowerCase();
  if (!q) return QUESTION_PATTERNS_BANK.slice(0, limit);

  const matched = QUESTION_PATTERNS_BANK.filter((p) => {
    if (p.question.toLowerCase().includes(q)) return true;
    if (p.category.toLowerCase().includes(q)) return true;
    if (p.keywords.some((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()))) return true;
    if (p.variations.some((v) => v.toLowerCase().includes(q))) return true;
    return false;
  });

  return matched.slice(0, limit);
}

export function getQuestionsByCategory(category?: QuestionCategory): QuestionPattern[] {
  if (!category) return QUESTION_PATTERNS_BANK;
  return QUESTION_PATTERNS_BANK.filter((p) => p.category === category);
}

export function getPatternBankStats() {
  const categoryCounts: Record<string, number> = {};
  for (const p of QUESTION_PATTERNS_BANK) {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  }
  return {
    totalPatterns: QUESTION_PATTERNS_BANK.length,
    totalVariations: QUESTION_PATTERNS_BANK.reduce((sum, p) => sum + p.variations.length, 0),
    categoryCounts,
  };
}
`;

const targetPath = path.join(process.cwd(), 'src', 'lib', 'ai', 'question-patterns.ts');
fs.writeFileSync(targetPath, tsContent, 'utf-8');
console.log('Successfully wrote question-patterns.ts pointing to bank JSON');
