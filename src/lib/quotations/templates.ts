export interface TemplateItem {
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  notes?: string;
}

export interface QuotationTemplate {
  id: string;
  title: string;
  category: string;
  description: string;
  defaultTaxRate: number;
  paymentTerms: string;
  termsAndConditions: string;
  notes: string;
  items: TemplateItem[];
}

export const DEFAULT_ORGANIZATION = {
  name: 'Modern Way Civil Solutions',
  tagline: 'સમસ્યા અમારી નિવારણ',
  ownerName: 'Govind Malviya',
  mobile: '9898035669, 9898035110',
  email: 'modernway9394@gmail.com',
  instagram: 'modernwaycs_2023',
  address: 'I 04 - S G Business Hub, Opp PNB Bank Sola Road, S G Highway, Gota',
  city: 'Ahmedabad',
  state: 'Gujarat',
  pincode: '382481',
  gstNumber: '24AAACM1234F1Z9',
};

export const QUOTATION_TEMPLATES: QuotationTemplate[] = [
  {
    id: 'DR_FIXIT_PU_270I',
    title: 'Dr. Fixit PU 270i Polyurethane Terrace Waterproofing (5-Step Procedure)',
    category: 'Terrace Waterproofing',
    description: 'The long life waterproofing procedure for Terrace area with the most trusted brand Pidilite. Dr. Fixit PU 270I single-component polyurethane with 3 to 3.2 MM crack bearing capacity and 400% elongation.',
    defaultTaxRate: 18,
    paymentTerms: '• 50% Advance with work order\n• 50% with Live work going during execution',
    termsAndConditions: `1. Payment Term 50% Advance & 50% with Live work going.
2. Electricity, water, Cement, any ladder is completely from your side.
3. Labour room should be managed at your side in labour colony.
4. GST is not including in this rate. If you want GST bill GST will be fine extra.
5. Labour will be working day and night shift by shift. You have to allow night working with halogen lights.
6. Final Measurement consider after completing the work with your engineer.
7. We will submit you daily work report to engineer or supervisor who is supervise us.
8. 10-Year Waterproofing Warranty issued upon 100% full payment settlement.`,
    notes: 'Single component PU 270I with 3 to 3.2mm crack bridging capacity and 400% elongation. 10 years manufacturer & applicator backed warranty.',
    items: [
      {
        description: `Dr Fixit PU 270i
The long life waterproofing procedure for Terrace area with the most trusted brand and the pioneer of Construction chemicals in the world Pidilite. We are using Dr fixit PU 270I Single component chemical with 3 to 3.2 MM crack bearing capacity and 400% elongation.

Procedure:
1 - We start the deep cleaning of RCC slab, remove all dust and material particles properly And Open the Crack V groove And Fill the all crack With crack sealant agent.
2- After that All Corner Sealed With Surrounding Vata.
3 - 1st coat Of Dr. Fixit Cipoxy 16D Epoxy Base Chemical Primer coat with 1:1 ratio.
4 - After the 1st coat of Primer we will Start 2nd Coat Of Dr. Fixit PU 270I For Strength with proper mixing Chemical. This coat should be horizontally Apply.
Notes : Gape of 12 to 18 hour ( Depends of temperature and Humidity Surface)
5 - Now we can Start 3rd Coat Dr. Fixit PU 270I with same ratio mention above this coat will be applied Vertically.

Note: - Dr. Fixit PU 270I of waterproofing only with 1.5mm thickness with the benefit of It comes with 10 year warrenty & excellent waterproofing properties, excellent elongation.`,
        unit: 'Sqmt',
        quantity: 450,
        rate: 860,
        notes: '1.5mm DFT, 10-Year Warranty'
      }
    ]
  },
  {
    id: 'EPOXY_FLOORING_HEAVY',
    title: 'Self-Levelling Heavy-Duty Epoxy Flooring System (3mm / 4mm Industrial)',
    category: 'Epoxy Flooring',
    description: 'High-performance seamless epoxy flooring designed for pharmaceutical factories, warehouses, automobile workshops, and heavy engineering plants.',
    defaultTaxRate: 18,
    paymentTerms: '• 50% Mobilization advance along with PO\n• 40% Running payment during intermediate coats\n• 10% Final settlement upon completion',
    termsAndConditions: `1. Continuous three-phase power supply and ambient moisture-free slab to be provided by client.
2. Concrete slab must have minimum M25 grade and at least 28 days curing with moisture below 4%.
3. Floor area must be barricaded and dust-free during chemical priming and self-leveling application.
4. Final joint cutting and elastomeric sealant filling as per layout.`,
    notes: 'Complies with GMP, FDA, and ISO clean-room hygiene standards. High abrasion and chemical spill resistance.',
    items: [
      {
        description: 'Mechanical surface preparation via planetary diamond grinding machines to eliminate laitance, grease, open concrete capillaries and achieve CSP 2-3 profile.',
        unit: 'sq.ft.',
        quantity: 5000,
        rate: 18,
        notes: 'Dust-free industrial vacuuming'
      },
      {
        description: 'Application of two-component solvent-free deep penetrating Epoxy Primer (Cipoxy 16D / Sikafloor 161) to seal substrate porosity.',
        unit: 'sq.ft.',
        quantity: 5000,
        rate: 42,
        notes: '100% solids epoxy resin'
      },
      {
        description: 'Laying 2mm intermediate high-strength Epoxy Screed underlayment mixed with graded silica quartz aggregate for impact and compressive load distribution.',
        unit: 'sq.ft.',
        quantity: 5000,
        rate: 75,
        notes: 'Heavy compressive load support'
      },
      {
        description: 'Application of 1mm self-levelling Aliphatic Polyurethane / Epoxy Topcoat (Cipoxy 20 / Sikafloor 264) with high-gloss mirror finish and RAL shade matching.',
        unit: 'sq.ft.',
        quantity: 5000,
        rate: 95,
        notes: 'Gloss finish, RAL shade choice'
      }
    ]
  },
  {
    id: 'EPOXY_TANK_COATING',
    title: 'Food-Grade & Potable Water Tank Epoxy Coating System',
    category: 'Epoxy Tank Coating',
    description: 'Certified non-toxic, anti-microbial epoxy lining for underground RCC sumps, fire tanks, and overhead potable drinking water reservoirs.',
    defaultTaxRate: 18,
    paymentTerms: '• 50% Advance with work order\n• 50% Live work going during application',
    termsAndConditions: `1. Dewatering and initial sludge evacuation from tank to be facilitated by client.
2. 230V halogen illumination and ventilation blowers for confined space safety to be provided.
3. 7 days curing required before filling potable water.`,
    notes: 'Certified non-leaching, non-toxic food-grade epoxy coating preventing algae, fungus and microbial growth.',
    items: [
      {
        description: 'High-pressure water jet washing (250 bar) to remove existing slime, moss, fungus and loose cement plaster from RCC walls, base and ceiling.',
        unit: 'sq.ft.',
        quantity: 3200,
        rate: 15,
        notes: 'High-pressure hydro cleaning'
      },
      {
        description: 'Groove cutting of all cold joints, honeycombs, and construction cracks; sealing with non-shrink structural polymer mortar and forming 75mm concave corner fillets (vata).',
        unit: 'rft',
        quantity: 240,
        rate: 85,
        notes: 'Polymer modified vata'
      },
      {
        description: 'Application of 1st coat certified Food-Grade Water-Based Epoxy Primer to guarantee tenacious adhesion on damp RCC surfaces.',
        unit: 'sq.ft.',
        quantity: 3200,
        rate: 48,
        notes: 'Potable water certified'
      },
      {
        description: 'Application of 2 coats Solvent-Free, 100% Solids Food-Grade Epoxy Tank Lining (Dr. Fixit Epoxy Tank Shield / Sika Poxitar) in Sky Blue finish.',
        unit: 'sq.ft.',
        quantity: 3200,
        rate: 110,
        notes: 'Zero VOC, anti-algal finish'
      }
    ]
  },
  {
    id: 'BATHROOM_SUNKEN_WATERPROOF',
    title: 'Sunken Slab & Wet Area Waterproofing (Epoxy Primer + Elastomeric Slurry)',
    category: 'Wet Area Waterproofing',
    description: 'Comprehensive dual-barrier waterproofing for sunken bathrooms, kitchen balconies, utility shafts, and WC blocks.',
    defaultTaxRate: 18,
    paymentTerms: '• 50% Advance\n• 50% Live work on site',
    termsAndConditions: `1. Plumbing core cutting and sanitary drain pipes must be rigidly fixed before starting work.
2. Ponding test with 75mm water depth will be conducted for 72 hours to certify 100% leak-proof seal.`,
    notes: 'Double-layer elastomeric barrier tested under 72-hour continuous water ponding.',
    items: [
      {
        description: 'Chipping, surface cleaning, and hacking of sunken concrete slab down to parent RCC structure.',
        unit: 'sq.ft.',
        quantity: 1800,
        rate: 14,
        notes: 'Debris removal to site dumping'
      },
      {
        description: 'Sealing plumbing pipe penetrations and PVC drain traps with high-strength non-shrink expanding grout (Dr. Fixit Grout M-60 / SikaGrout 214).',
        unit: 'nos',
        quantity: 36,
        rate: 450,
        notes: 'Eliminates pipe-joint leaks'
      },
      {
        description: 'Forming 50mm x 50mm corner coving fillets (vata) with polymer modified mortar (1:3) mixed with Dr. Fixit Pidicrete URP.',
        unit: 'rft',
        quantity: 380,
        rate: 65,
        notes: 'Radius corner transition'
      },
      {
        description: 'Application of 2 coats 2-component flexible acrylic polymer modified cementitious elastomeric waterproofing membrane (Dr. Fixit Fastflex / SikaTop Seal 107) with glass fiber mesh.',
        unit: 'sq.ft.',
        quantity: 1800,
        rate: 92,
        notes: 'Includes 72-hr ponding test'
      }
    ]
  },
  {
    id: 'CRYSTALLINE_BASEMENT',
    title: 'Basement Retaining Wall & Raft Crystalline Waterproofing',
    category: 'Basement Waterproofing',
    description: 'Permanent deep crystalline capillary waterproofing system for subterranean RCC raft foundations and perimeter retaining walls subject to extreme hydrostatic pressure.',
    defaultTaxRate: 18,
    paymentTerms: '• 50% Advance with work order\n• 50% Running with live work',
    termsAndConditions: `1. Continuous dewatering must be maintained by client until crystalline coat achieves final set.
2. Surface must be thoroughly pre-wetted to saturated surface dry (SSD) condition before application.`,
    notes: 'Penetrates up to 300mm into concrete capillaries, continuously self-healing microcracks up to 0.4mm.',
    items: [
      {
        description: 'High-pressure surface scarification and water flushing to expose open capillary pores on retaining wall RCC surface.',
        unit: 'sq.ft.',
        quantity: 8500,
        rate: 16,
        notes: 'Capillary opening treatment'
      },
      {
        description: 'V-groove cutting (20mm x 20mm) along all construction cold joints, tie-rod holes, and honeycombs; plugging with rapid-setting crystalline waterstop plug.',
        unit: 'rft',
        quantity: 650,
        rate: 140,
        notes: 'Instant hydraulic waterstop'
      },
      {
        description: 'Application of 1st coat Penetron / MasterLife / Dr. Fixit Krystalline waterproofing slurry coating at 1.0 kg/sqm by stiff bristle brush.',
        unit: 'sq.ft.',
        quantity: 8500,
        rate: 65,
        notes: 'Chemical active crystallization'
      },
      {
        description: 'Application of 2nd cross-coat Crystalline waterproofing slurry (1.0 kg/sqm) perpendicular to first coat including 5-day wet curing.',
        unit: 'sq.ft.',
        quantity: 8500,
        rate: 55,
        notes: 'Permanent internal barrier'
      }
    ]
  },
  {
    id: 'PU_INJECTION_GROUT',
    title: 'High-Pressure Polyurethane (PU) Foam Injection Grouting',
    category: 'Injection Grouting',
    description: 'Specialized chemical injection grouting to stop active high-flow water leakages in retaining walls, basements, tunnels, lift pits, and RCC dams.',
    defaultTaxRate: 18,
    paymentTerms: '• 50% Mobilization advance\n• 50% On completion of leakage stoppage',
    termsAndConditions: `1. Continuous water seepage must be active for hydrophobic PU foam activation.
2. Unrestricted access to both ceiling/wall face and 230V power for high-pressure injection pumps.`,
    notes: 'Expands up to 30 times upon water contact, permanently flexible rubber gasket within cracks.',
    items: [
      {
        description: 'Drilling 14mm diameter injection holes at 45-degree angle intersecting structural crack / joint plane at staggered intervals (200mm to 300mm).',
        unit: 'nos',
        quantity: 120,
        rate: 220,
        notes: 'Staggered port preparation'
      },
      {
        description: 'Fixing heavy-duty brass mechanical injection packers equipped with high-pressure ball check valves and tightening to 150 bar hold.',
        unit: 'nos',
        quantity: 120,
        rate: 180,
        notes: 'High-pressure brass packers'
      },
      {
        description: 'Injection of single-component hydrophobic Polyurethane foam resin (Dr. Fixit PU Foam 200 / MC-Bauchemie / Fosroc) using 250-bar electric piston pump until complete refusal.',
        unit: 'kg',
        quantity: 150,
        rate: 1450,
        notes: 'Instant 30x expansion foam'
      },
      {
        description: 'Cutting off packer stems after 24-hr curing and flush patch sealing packer holes with rapid-hardening polymer mortar.',
        unit: 'nos',
        quantity: 120,
        rate: 60,
        notes: 'Surface flush finishing'
      }
    ]
  },
  {
    id: 'TERRACE_COBA_PU',
    title: 'Terrace Brickbat Coba with Top UV Elastomeric PU Coating',
    category: 'Terrace Waterproofing',
    description: 'Traditional heavy slope-drainage brickbat coba integrated with modern top polyurethane elastomeric cool-roof liquid membrane.',
    defaultTaxRate: 18,
    paymentTerms: '• 50% Advance\n• 50% Running with live work',
    termsAndConditions: `1. Water, electricity, cement, scaffolding provided by client.
2. Rainwater outlet khurras and drain downspouts must be installed before laying coba.`,
    notes: 'Dual protection: Thermal insulation + slope water drainage + 100% seamless UV-resistant PU membrane.',
    items: [
      {
        description: 'Base RCC cleaning, cement slurry grouting with waterproofing chemical admixture (Dr. Fixit Pidiproof LW+).',
        unit: 'sq.ft.',
        quantity: 3500,
        rate: 12,
        notes: 'Bonding base slurry'
      },
      {
        description: 'Laying well-burnt clay brickbat coba in graded thickness (75mm to 110mm) to achieve 1:100 slope towards rainwater outlets, bedded in 1:5 cement mortar.',
        unit: 'sq.ft.',
        quantity: 3500,
        rate: 145,
        notes: 'Graded slope drainage'
      },
      {
        description: 'Top IPS smooth cement plaster (20mm thick) in 1:4 mortar trowelled to false 300x300mm chequered finish including water ponding curing for 14 days.',
        unit: 'sq.ft.',
        quantity: 3500,
        rate: 45,
        notes: '14-day ponding curing'
      },
      {
        description: 'Application of 2 coats UV-resistant elastomeric Polyurethane hybrid liquid membrane (White Cool-Roof SRI > 105) over IPS base for total thermal & waterproof shield.',
        unit: 'sq.ft.',
        quantity: 3500,
        rate: 68,
        notes: 'Solar reflective, cool roof'
      }
    ]
  },
  {
    id: 'ESD_ANTI_STATIC_EPOXY',
    title: 'Anti-Static ESD Conductive Epoxy Flooring System',
    category: 'Epoxy Flooring',
    description: 'Electrostatic Discharge (ESD) protective floor topping for electronics cleanrooms, semiconductor manufacturing, explosive ordnance depots, and server serveries.',
    defaultTaxRate: 18,
    paymentTerms: '• 50% Advance with order\n• 40% On copper grid & primer laying\n• 10% On ESD resistance certification',
    termsAndConditions: `1. Dedicated building earth pits (< 1 Ohm resistance) must be brought to floor level by client.
2. Ambient humidity must be between 30% and 70% during application.`,
    notes: 'Point-to-ground electrical resistance guaranteed between 1.0 x 10^4 to 1.0 x 10^6 Ohms (conductive) / 1.0 x 10^9 Ohms (dissipative).',
    items: [
      {
        description: 'Substrate diamond grinding and installation of conductive self-adhesive copper tape grid (10mm wide x 0.08mm thick) connected to copper earthing studs.',
        unit: 'sq.ft.',
        quantity: 2400,
        rate: 45,
        notes: 'Complete grounding earthing network'
      },
      {
        description: 'Application of continuous black carbon conductive epoxy primer coat (Cipoxy 17ESD / Sikafloor 220W Conductive) ensuring continuous conductivity.',
        unit: 'sq.ft.',
        quantity: 2400,
        rate: 65,
        notes: 'Conductive primer film'
      },
      {
        description: 'Laying 2mm heavy-duty Anti-Static ESD Conductive Self-Levelling Epoxy topcoat (Cipoxy 25ESD) with spark resistance and ESD testing certificate.',
        unit: 'sq.ft.',
        quantity: 2400,
        rate: 165,
        notes: 'Tested per ANSI/ESD S20.20'
      }
    ]
  },
  {
    id: 'EXPANSION_JOINT_SEALANT',
    title: 'Heavy Movement Expansion Joint Treatment (Polysulphide & Backer Rod)',
    category: 'Joint Treatment',
    description: 'Specialized structural movement joint sealing for building isolation joints, podium slabs, bridge approaches, and precast concrete panels.',
    defaultTaxRate: 18,
    paymentTerms: '• 50% Advance\n• 50% Live work on site',
    termsAndConditions: `1. Joint gaps must be free of trapped building debris, mud, and temporary timber inserts.
2. Backer rod diameter must be 25% larger than the joint width for optimal compression profile.`,
    notes: 'Accommodates +/- 25% joint movement capability. Extreme UV and weathering resistance.',
    items: [
      {
        description: 'Raking, mechanical blade grinding of joint sides, vacuum cleaning, and masking tape edge lining for sharp joint edges.',
        unit: 'rft',
        quantity: 450,
        rate: 45,
        notes: 'Joint preparation'
      },
      {
        description: 'Insertion of closed-cell polyethylene foam backer rod (25mm/35mm diameter) to set proper sealant depth-to-width ratio (1:2).',
        unit: 'rft',
        quantity: 450,
        rate: 35,
        notes: 'Prevents 3-point adhesion'
      },
      {
        description: 'Application of specialized two-component porous surface bonding primer along both internal vertical faces of the joint.',
        unit: 'rft',
        quantity: 450,
        rate: 40,
        notes: 'High shear adhesion primer'
      },
      {
        description: 'Gun application of heavy-grade two-component Polysulphide Sealant (Dr. Fixit Pidiseal PS 42P / Fosroc Thioflex 600) with concave tool finish.',
        unit: 'rft',
        quantity: 450,
        rate: 220,
        notes: 'BS 4254 / ASTM C920 compliant'
      }
    ]
  },
  {
    id: 'EXTERNAL_WALL_RAIN_PROTECT',
    title: 'Exterior Wall Rain Seepage & Crack-Bridging Treatment',
    category: 'External Waterproofing',
    description: 'Specialized exterior wall waterproofing against high-velocity monsoon rainfall, wind-driven moisture seepage, and efflorescence.',
    defaultTaxRate: 18,
    paymentTerms: '• 50% Advance\n• 50% Running during live work',
    termsAndConditions: `1. External tubular steel scaffolding or motorized suspended cradle to be arranged/facilitated at site.
2. Power point for pressure washer at ground level.`,
    notes: 'Elastomeric crack-bridging coating with 7-year performance warranty against water ingress.',
    items: [
      {
        description: 'High-pressure wash (180 bar) of exterior facade to remove algae, moss, efflorescence salts and loose old paint.',
        unit: 'sq.ft.',
        quantity: 12000,
        rate: 9,
        notes: 'External facade washing'
      },
      {
        description: 'V-groove chase cutting of external hairline and structural plaster cracks; filling with exterior polymer fiber-reinforced crack filler (Dr. Fixit Crack-X Paste).',
        unit: 'rft',
        quantity: 1400,
        rate: 38,
        notes: 'Crack-X Paste elastomeric fill'
      },
      {
        description: 'Application of 1st coat penetrating acrylic exterior waterproof primer to strengthen plaster surface.',
        unit: 'sq.ft.',
        quantity: 12000,
        rate: 18,
        notes: 'Efflorescence resistant primer'
      },
      {
        description: 'Application of 2 coats high-build Elastomeric Exterior Waterproof Coating (Dr. Fixit Raincoat Neo / Asian Paints SmartCare) with 200% elongation and anti-dirt pickup.',
        unit: 'sq.ft.',
        quantity: 12000,
        rate: 42,
        notes: '7-Year waterproofing warranty'
      }
    ]
  },
  {
    id: 'POLYUREA_FAST_CURE',
    title: 'Fast-Curing Pure Polyurea Spray Applied Waterproofing',
    category: 'Polyurea Coatings',
    description: 'Instant-curing (5-10 seconds) heavy-traffic elastomeric pure polyurea waterproofing membrane for commercial podiums, parking decks, and stadium bleachers.',
    defaultTaxRate: 18,
    paymentTerms: '• 50% Advance with machinery mobilization\n• 50% Live work on site',
    termsAndConditions: `1. Continuous 415V three-phase 32A power supply for computerized hydraulic spray reactor.
2. Slab moisture content must be validated below 4.5% using electronic impedance meter.`,
    notes: 'Walkable in 60 seconds; heavy vehicular traffic in 2 hours. Elongation > 350%, tensile strength > 18 MPa.',
    items: [
      {
        description: 'Shot blasting or aggressive diamond scarification of concrete surface followed by high-vacuum dust extraction.',
        unit: 'sq.ft.',
        quantity: 7500,
        rate: 22,
        notes: 'CSP 3-4 mechanical key'
      },
      {
        description: 'Fast-curing moisture barrier epoxy primer coat with quartz scatter broadcast to create mechanical anchoring bridge.',
        unit: 'sq.ft.',
        quantity: 7500,
        rate: 55,
        notes: 'Quartz aggregate scatter'
      },
      {
        description: 'Hot spray application (65°C / 2000 psi) of 2.0mm thick 100% Pure Polyurea membrane using high-pressure proportioner machine.',
        unit: 'sq.ft.',
        quantity: 7500,
        rate: 240,
        notes: 'Seamless, instant cure'
      },
      {
        description: 'Application of UV-stable aliphatic polyurethane traffic topcoat with slip-resistant aluminium oxide broadcast.',
        unit: 'sq.ft.',
        quantity: 7500,
        rate: 75,
        notes: 'Vehicular wear coat'
      }
    ]
  },
  {
    id: 'PODIUM_ROOF_GARDEN',
    title: 'Podium Slab & Roof Garden Root-Resistant Waterproofing',
    category: 'Podium Waterproofing',
    description: 'Engineered multi-layer waterproofing with chemical anti-root barrier, protection geotextile, and drainage cells for landscaped decks and green roofs.',
    defaultTaxRate: 18,
    paymentTerms: '• 50% Advance with PO\n• 50% Live work progress',
    termsAndConditions: `1. Slope towards perimeter drainage gullies must be maintained at minimum 1:80.
2. 48-hour continuous water test mandatory prior to laying drainage boards and landscaping soil.`,
    notes: 'Certified root-penetration resistant according to FLL standards. Protects concrete from soil humic acids.',
    items: [
      {
        description: 'RCC substrate cleaning and forming 75mm x 75mm radius coving at all parapet and planter box upstands.',
        unit: 'sq.ft.',
        quantity: 4200,
        rate: 15,
        notes: 'Perimeter upstand prep'
      },
      {
        description: 'Laying 2-coat heavy-duty root-resistant polyurethane / SBS elastomeric waterproofing membrane (2.5mm DFT) extending 300mm above finished soil line.',
        unit: 'sq.ft.',
        quantity: 4200,
        rate: 135,
        notes: 'FLL Root-resistant certified'
      },
      {
        description: 'Laying 30mm thick high-density polyethylene (HDPE) interlocking Dimpled Drainage Cells with water retention cups.',
        unit: 'sq.ft.',
        quantity: 4200,
        rate: 65,
        notes: 'Rapid stormwater runoff drainage'
      },
      {
        description: 'Laying 150 GSM non-woven needle-punched polypropylene Geotextile filtration fabric over drainage cells to prevent soil silt clogging.',
        unit: 'sq.ft.',
        quantity: 4200,
        rate: 28,
        notes: 'Non-woven filter fleece'
      }
    ]
  },
  {
    id: 'APP_MEMBRANE_TORCH_ON',
    title: 'APP Modified Bituminous Torch-On Membrane System (3mm / 4mm)',
    category: 'Membrane Waterproofing',
    description: 'Heavy polyester-reinforced Atactic Polypropylene (APP) torch-applied polymer-bituminous waterproofing membrane for roofs, foundation basements, and bridge decks.',
    defaultTaxRate: 18,
    paymentTerms: '• 50% Advance\n• 50% Live work on site',
    termsAndConditions: `1. LPG gas cylinders and open-flame safety clearance to be coordinated at site.
2. Minimum 100mm side overlap and 150mm end overlap strictly maintained and flame-fused.`,
    notes: 'Non-woven spunbond polyester core gives high puncture resistance and thermal stability under Indian extreme summer climates.',
    items: [
      {
        description: 'Deep surface sweeping, dust cleaning, and edge beveling on roof slab.',
        unit: 'sq.ft.',
        quantity: 6000,
        rate: 8,
        notes: 'Substrate preparation'
      },
      {
        description: 'Application of cold-applied fast-drying solvent-based bituminous primer at 0.35 kg/sqm to enhance substrate bonding.',
        unit: 'sq.ft.',
        quantity: 6000,
        rate: 24,
        notes: 'Solvent bituminous primer'
      },
      {
        description: 'Torch-on application of 3mm / 4mm thick APP modified bituminous waterproofing membrane (polyester reinforced) with 100mm flame-welded overlaps.',
        unit: 'sq.ft.',
        quantity: 6000,
        rate: 85,
        notes: '160 gsm polyester core'
      },
      {
        description: 'Sealing perimeter flashings with aluminium counter-flashing clamp strip and bitumen mastic sealant.',
        unit: 'rft',
        quantity: 360,
        rate: 65,
        notes: 'Parapet mechanical clamp'
      }
    ]
  },
  {
    id: 'EPOXY_MORTAR_STRUCTURAL_REPAIR',
    title: 'Structural Concrete Rehabilitation & Low-Viscosity Epoxy Crack Injection',
    category: 'Concrete Repair',
    description: 'Comprehensive structural rehabilitation for distressed concrete columns, slab spalling, beam shear cracks, and corroded rebar structures.',
    defaultTaxRate: 18,
    paymentTerms: '• 50% Advance with order\n• 50% Running with live work',
    termsAndConditions: `1. Propping and structural shoring for load-bearing members to be verified prior to chipping.
2. Minimum concrete compressive strength recovery validated by ultrasonic pulse velocity (UPV) test.`,
    notes: 'Restores original structural monolithic integrity and tensile load-transfer capacity.',
    items: [
      {
        description: 'Chipping spalled and cracked concrete down to sound core, removing loose debris and exposing corroded steel rebars along entire circumference.',
        unit: 'sq.ft.',
        quantity: 1200,
        rate: 45,
        notes: 'Structural concrete breakout'
      },
      {
        description: 'Mechanical wire-brushing and sand-blasting of corroded rebar followed by application of Zinc-Rich Anti-Corrosion Primer (Dr. Fixit Rust Remover + Zinc Primer).',
        unit: 'sq.ft.',
        quantity: 1200,
        rate: 65,
        notes: 'Zinc cathodic protection'
      },
      {
        description: 'Application of structural Epoxy Bonding Agent (Sikadur 32 / Dr. Fixit Epoxy Bond) followed by hand packing Polymer-Modified Structural Repair Mortar (Sika MonoTop).',
        unit: 'sq.ft.',
        quantity: 1200,
        rate: 195,
        notes: 'High compressive strength mortar'
      },
      {
        description: 'Low-pressure injection of ultra-low viscosity structural epoxy resin (Cipoxy 15 / Sikadur 52) into deep structural cracks through surface-mounted nipples.',
        unit: 'nos',
        quantity: 80,
        rate: 380,
        notes: 'Monolithic crack rebonding'
      }
    ]
  }
];
