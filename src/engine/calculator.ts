export interface CalcRule {
  id: string;
  label: string;
  trigger: string; // what the user enters
  days: number;
  afterService: boolean; // Rule 2.514(b): +5 days when served by mail
  mailDaysOverride?: number; // e.g. Rule 1.351(b) uses 15 instead of 10+5
  citation: string;
  note?: string;
  followOn?: { label: string; days: number; citation: string };
}

export const CALC_RULES: CalcRule[] = [
  { id: "answer", label: "Answer the complaint", trigger: "Date of service of process", days: 20, afterService: false, citation: "Fla. R. Civ. P. 1.140(a)(1)" },
  { id: "answerAfterRuling", label: "Answer after the court rules on a 1.140 motion", trigger: "Date the order was served", days: 10, afterService: true, citation: "Fla. R. Civ. P. 1.140(a)(3)" },
  { id: "amended", label: "Respond to an amended pleading", trigger: "Date the amended pleading was served", days: 10, afterService: true, citation: "Fla. R. Civ. P. 1.190(a)", note: "Unless the court orders otherwise." },
  { id: "discovery", label: "Answer interrogatories / requests for production / requests for admission", trigger: "Date discovery was served", days: 30, afterService: true, citation: "Fla. R. Civ. P. 1.340(a), 1.350(b), 1.370(a)", note: "Unanswered requests for admission are deemed admitted." },
  { id: "discoveryWithProcess", label: "Respond to discovery served with the summons", trigger: "Date of service of process", days: 45, afterService: false, citation: "Fla. R. Civ. P. 1.340(a), 1.350(b), 1.370(a)" },
  { id: "subpoena", label: "Issue non-party subpoena duces tecum after notice of intent", trigger: "Date notice of intent was served", days: 10, afterService: true, mailDaysOverride: 15, citation: "Fla. R. Civ. P. 1.351(b)", note: "Earliest date the subpoena may issue (10 days if served by delivery or e-mail, 15 if by mail), absent objection." },
  { id: "msjResponse", label: "Serve response to a motion for summary judgment", trigger: "Date the MSJ was served", days: 40, afterService: true, citation: "Fla. R. Civ. P. 1.510(c)(5)", followOn: { label: "Earliest MSJ hearing date", days: 10, citation: "Fla. R. Civ. P. 1.510(c)(6)" }, note: "The response must include the nonmovant's supporting factual position." },
  { id: "pfsAccept", label: "Accept a proposal for settlement", trigger: "Date the proposal was served", days: 30, afterService: true, citation: "Fla. R. Civ. P. 1.442(f)(1)", note: "A proposal not accepted in writing within 30 days is deemed rejected." },
  { id: "safeHarbor", label: "§57.105 safe-harbor period ends", trigger: "Date the sanctions motion was served", days: 21, afterService: false, citation: "§57.105(4), Fla. Stat.", note: "The motion may not be filed until 21 days after service if the challenged paper is not withdrawn or corrected." },
  { id: "rehearing", label: "Motion for new trial / rehearing", trigger: "Date of verdict or filing of judgment", days: 15, afterService: false, citation: "Fla. R. Civ. P. 1.530(b)" },
  { id: "fees", label: "Motion for attorneys' fees and costs", trigger: "Date the judgment was filed", days: 30, afterService: false, citation: "Fla. R. Civ. P. 1.525" },
  { id: "appeal", label: "Notice of appeal", trigger: "Date of rendition of the order", days: 30, afterService: false, citation: "Fla. R. App. P. 9.110(b)", note: "Jurisdictional — cannot be extended." },
  { id: "service", label: "Serve original process", trigger: "Date the complaint was filed", days: 120, afterService: false, citation: "Fla. R. Civ. P. 1.070(j)" },
];
