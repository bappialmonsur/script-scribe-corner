// Bangladesh standard GPA-5 grading on percentage
export type GradeInfo = { grade: string; gpa: number; color: string };

export function calcGrade(marks: number | null | undefined, fullMarks: number): GradeInfo {
  if (marks == null || isNaN(marks as number)) {
    return { grade: "—", gpa: 0, color: "text-muted-foreground" };
  }
  const pct = (Number(marks) / fullMarks) * 100;
  if (pct >= 80) return { grade: "A+", gpa: 5.0, color: "text-green-600" };
  if (pct >= 70) return { grade: "A", gpa: 4.0, color: "text-green-600" };
  if (pct >= 60) return { grade: "A-", gpa: 3.5, color: "text-blue-600" };
  if (pct >= 50) return { grade: "B", gpa: 3.0, color: "text-blue-600" };
  if (pct >= 40) return { grade: "C", gpa: 2.0, color: "text-amber-600" };
  if (pct >= 33) return { grade: "D", gpa: 1.0, color: "text-amber-600" };
  return { grade: "F", gpa: 0.0, color: "text-red-600" };
}

export const EXAM_TYPE_LABEL: Record<string, string> = {
  daily: "দৈনিক",
  weekly: "সাপ্তাহিক",
  model_test: "মডেল টেস্ট",
};

export const EXAM_PATTERN_LABEL: Record<string, string> = {
  written: "লিখিত",
  mcq: "বহুনির্বাচনি",
};

export const CLASS_LEVELS = ["5", "6", "7", "8", "9", "10", "11", "12"];

export const DEPT_LABEL: Record<string, string> = {
  none: "প্রযোজ্য নয়",
  science: "বিজ্ঞান",
  business: "ব্যবসায় শিক্ষা",
};

export const BATCH_LABEL: Record<string, string> = {
  morning: "সকাল",
  afternoon: "বিকাল",
  evening: "সন্ধ্যা",
};

// শ্রেণি ৯-১২ এ বিভাগ প্রযোজ্য
export const DEPT_CLASS_LEVELS = ["9", "10", "11", "12"];

const BN_DIGITS = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
export function bnNum(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => BN_DIGITS[+d]);
}
export function bnClass(c: number | string): string {
  return bnNum(c) + "ম";
}


// Calculate rank (1-based dense rank by marks desc; nulls last share rank 0)
export function calcPositions<T extends { student_id: string; marks: number | null }>(
  rows: T[],
): Map<string, number> {
  const scored = rows
    .filter((r) => r.marks != null)
    .sort((a, b) => Number(b.marks) - Number(a.marks));
  const pos = new Map<string, number>();
  let rank = 0;
  let prev: number | null = null;
  let idx = 0;
  for (const r of scored) {
    idx++;
    const m = Number(r.marks);
    if (prev === null || m < prev) {
      rank = idx;
      prev = m;
    }
    pos.set(r.student_id, rank);
  }
  return pos;
}
