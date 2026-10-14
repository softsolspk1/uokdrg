export const STAFF_TYPES = ["Teaching", "Non-Teaching"] as const;

export const STATUSES = [
  "Working",
  "Study Leave",
  "Foreign Study Leave",
  "Leave (Other)",
  "Unauthorized Absence",
  "On Lien",
  "Deputation",
  "Suspended",
  "Retired",
  "Resigned",
  "Terminated",
  "Deceased",
] as const;

export const ACTIVE_STATUSES = ["Working", "Study Leave", "Foreign Study Leave", "Leave (Other)", "Unauthorized Absence", "On Lien", "Deputation", "Suspended"];

export const TEACHING_DESIGNATIONS = ["Professor", "Associate Professor", "Assistant Professor", "Lecturer", "Meritorious Professor", "Professor Emeritus", "Visiting Faculty"];

export const EMPLOYMENT_TYPES = ["Permanent", "Contract", "Tenure Track (TTS)", "Daily Wages", "Visiting", "Deputation", "Ad-hoc"];

export const GENDERS = ["Male", "Female", "Other"];
export const MARITAL = ["Single", "Married", "Widowed", "Divorced"];
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const RELIGIONS = ["Islam", "Christianity", "Hinduism", "Sikhism", "Ahmadi", "Other"];
export const DOMICILES = ["Sindh (Urban)", "Sindh (Rural)", "Punjab", "Khyber Pakhtunkhwa", "Balochistan", "Islamabad", "Gilgit-Baltistan", "AJK", "Other"];

export const DOCUMENT_CATEGORIES = [
  "CNIC",
  "Photograph",
  "Appointment Letter",
  "Joining Report",
  "Promotion / Upgradation Order",
  "Transfer / Posting Order",
  "Educational Certificate / Degree",
  "Experience Certificate",
  "Service Book",
  "Leave Order",
  "Medical Certificate",
  "NOC",
  "Annual Confidential Report (ACR / PER)",
  "Charge Assumption / Relinquishment",
  "Retirement / Pension Papers",
  "Other",
];

export const SERVICE_EVENTS = ["Appointment", "Confirmation", "Promotion", "Upgradation", "Transfer / Posting", "Additional Charge", "Selection Grade / Move-over", "Deputation", "Current Posting", "Disciplinary", "Retirement", "Other"];

export const LEAVE_TYPES = ["Earned Leave", "Casual Leave", "Medical Leave", "Study Leave", "Foreign Study Leave", "Ex-Pakistan Leave", "Maternity Leave", "Hajj Leave", "Extra-Ordinary Leave (EOL)", "LPR", "Other"];

export const RELATIONS = ["Spouse", "Son", "Daughter", "Father", "Mother", "Brother", "Sister", "Other"];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const PAGE_SIZE = 25;
