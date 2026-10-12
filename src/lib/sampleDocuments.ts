export interface SampleDocument {
  id: string;
  title: string;
  category: string;
  suggestedQuery: string;
  content: string;
}

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    id: 'sample-hr',
    title: 'Employee Annual Performance Review (HR Confidential)',
    category: 'Human Resources & Compensation',
    suggestedQuery: 'Summarize the employee key technical achievements and training goals for Q4 without personal identifiers or compensation details.',
    content: `CONFIDENTIAL HUMAN RESOURCES DOCUMENT
Performance Review Period: Fiscal Year 2025-2026
Prepared by: Director Marcus Vance (m.vance@apex-global.com)
Date: October 14, 2026

1. EMPLOYEE INFORMATION
Employee Name: Sarah Jenkins
Employee ID: EMP-94821
Social Security Number: 452-98-3190
Department: Infrastructure Reliability Engineering
Personal Mobile: +1 (555) 234-5678
Residential Address: 742 Evergreen Terrace, Springfield, OR 97477
Emergency Contact: Arthur Jenkins (+1 555-890-4412)

2. COMPENSATION & MERIT ADJUSTMENT
Current Base Salary: $178,000 per annum
Target Bonus: $32,500 (18.25% achieved)
Direct Deposit Account: Routing 021000021, Account 88921049281
Stock Grant: 450 RSUs vesting over 4 years

3. TECHNICAL ACHIEVEMENTS & CONTRIBUTIONS
Sarah led the zero-downtime database migration from legacy shards to distributed CockroachDB, reducing p99 query latency by 42%. She designed the Kubernetes auto-scaler configuration which eliminated pod thrashing during peak holiday traffic. She also authored the disaster recovery runbook adopted across all engineering pods.

4. GROWTH AREAS & RECOMMENDATIONS
Improve cross-departmental documentation handoffs to the customer success team. Sarah is recommended to complete the Advanced Distributed Systems Architecture Certification in Q4. Overall rating: Exceeds Expectations.

Signatures:
Reviewer: Marcus Vance, VP Engineering
Reviewee: Sarah Jenkins (signed via DocuSign)`
  },
  {
    id: 'sample-incident',
    title: 'Production Incident Escalation & Log Trace',
    category: 'Security & DevOps',
    suggestedQuery: 'Analyze the system memory exhaustion root cause and remediation actions for the engineering team.',
    content: `INCIDENT POST-MORTEM REPORT: INC-2026-8819
Severity: Level 1 Outage
On-Call Lead: Devops Engineer Carlos Mendoza (c.mendoza@telecom-corp.net)
Incident Channel: #incident-war-room-2026

INCIDENT TIMELINE & IMPACT:
At 04:15 UTC, the primary payment ingest node at 192.168.1.104 began failing health checks. The secondary gateway at 10.0.4.22 reported connection timeouts. Approximately 1,200 checkout requests were interrupted.

AFFECTED CUSTOMER RECORDS LEAKED IN TRACE:
Customer: Elena Rostova (elena.rostova@venture-tech.co)
Attempted Card Payment: 4532-8921-3482-9012 (Auth Code: 8912)
Billing Address: 100 Market St, Suite 400, San Francisco, CA 94105
Phone: +1 415-890-1234

DEBUG LOG EXCERPT & SECRETS:
[04:16:12] ERROR: OutOfMemoryError in worker thread pool.
[04:16:13] WARN: Failed auth token exchange with upstream API.
[04:16:14] DEBUG: Active environment key sk-ant-api03-abcdef1234567890abcdef1234567890 was rejected due to rate limiting.
[04:16:15] Redis connection reset by peer at 172.16.0.48:6379.

ROOT CAUSE ANALYSIS:
An unindexed join query in the recurring billing cron triggered an unbounded memory allocation in the worker node. The garbage collector stalled for 48 seconds, triggering false-positive pod restarts.

REMEDIATION & ACTION ITEMS:
1. Add compound composite index on billing_runs(scheduled_at, status).
2. Implement strict circuit breaker with maximum 50MB batch buffer.
3. Rotate and vault all API tokens in production secrets manager.`
  },
  {
    id: 'sample-medical',
    title: 'Clinical Patient Discharge Summary',
    category: 'Healthcare & PHI',
    suggestedQuery: 'Extract the patient medication dosage schedule, dietary restrictions, and follow-up appointment timeline.',
    content: `MEMORIAL HOSPITAL - INPATIENT DISCHARGE SUMMARY
Attending Physician: Dr. Arthur Mitchell, MD (amitchell@memorialhealth.org)
Department: Cardiology & Internal Medicine

PATIENT DEMOGRAPHICS (CONFIDENTIAL PHI):
Patient Name: Robert D. Chen
Medical Record Number (MRN): 8492019
Date of Birth: 05/14/1968
Home Address: 482 Elmwood Ave, Apartment 3B, Evanston, IL 60201
Emergency Contact: Linda Chen (Wife), Phone: +1 312-555-0199
Insurance: BlueCross PPO Group # 98214-BC

DIAGNOSIS & CLINICAL COURSE:
Admitted for acute chest pain secondary to moderate unstable angina. Successfully underwent non-emergent cardiac catheterization with drug-eluting stent placement to the left anterior descending artery. Patient tolerated procedure well without dysrhythmia.

DISCHARGE MEDICATIONS:
1. Atorvastatin 80 mg PO once daily at bedtime.
2. Clopidogrel (Plavix) 75 mg PO once daily every morning with breakfast.
3. Aspirin 81 mg PO once daily.
4. Metoprolol Tartrate 25 mg PO twice daily.

DIETARY & ACTIVITY RESTRICTIONS:
Low-sodium Mediterranean diet (< 2,000 mg sodium daily). No lifting heavy items exceeding 15 lbs for the next two weeks. Daily light walking 20-30 minutes encouraged.

FOLLOW-UP CARE:
Cardiology clinic appointment scheduled in 14 days with Dr. Mitchell. Laboratory work (lipid panel and basic metabolic panel) to be drawn 48 hours prior to visit.`
  }
];
