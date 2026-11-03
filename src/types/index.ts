export type Role = 'admin' | 'pelapor' | 'pic' | 'manajemen';

export type UnitRegion = 'Jawa' | 'Luar Jawa' | 'Korporat' | 'Non-UPDL';
export type UnitType = 'UPDL' | 'CORPU' | 'NON_UPDL';

export interface Unit {
  unitId: string;
  unitCode: string;
  unitName: string;
  unitRegion: UnitRegion;
  unitFocus: string;
  unitType: UnitType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HxmsComponent {
  id: string;
  code: string;
  name: string;
  description: string;
  subcategories: string[];
}

export type TicketType = 'Insiden' | 'Keluhan' | 'Permintaan Layanan' | 'Permintaan Perubahan';

export type ImpactLevel = 'Individu' | 'Tim' | 'Departemen' | 'Banyak Pengguna';

export type UrgencyLevel = 'Rendah' | 'Sedang' | 'Tinggi';

export type PriorityLevel = 'Kritis' | 'Tinggi' | 'Sedang' | 'Rendah';

export type TicketStatus =
  | 'Baru'
  | 'Diverifikasi'
  | 'Ditugaskan'
  | 'Dalam Proses'
  | 'Menunggu Pelapor'
  | 'Menunggu Pihak Ketiga'
  | 'Menunggu Persetujuan'
  | 'Selesai'
  | 'Ditutup'
  | 'Ditolak';

export interface User {
  uid: string;
  username?: string;
  employeeId: string; // NIP
  name: string;
  email: string;
  department: string;
  position?: string; // Jabatan
  role: Role;
  unitId?: string; // Relasi ke Unit 12 Master Data / Unit Umum
  unitCode?: string;
  unitName?: string;
  unitType?: UnitType;
  team?: string;
  expertise?: string[];
  isActive: boolean;
  avatarUrl?: string;
  phone?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AdminAuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action:
    | 'USER_CREATED'
    | 'USER_UPDATED'
    | 'ROLE_CHANGED'
    | 'STATUS_CHANGED'
    | 'PASSWORD_RESET'
    | 'TICKETS_REASSIGNED'
    | 'UNIT_CHANGED'
    | 'UNIT_CLASSIFIED'
    | 'REGISTRATION_APPROVED'
    | 'REGISTRATION_REJECTED'
    | 'BATCH_REGISTRATION_APPROVED'
    | 'BATCH_REGISTRATION_REJECTED';
  targetUserId: string;
  targetUserName: string;
  targetUserNip?: string;
  details: string;
  createdAt: string;
}

export interface BatchProcessItemResult {
  requestId: string;
  fullName: string;
  employeeId: string;
  corporateEmail?: string;
  unitName?: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  reason?: string;
}

export interface BatchProcessSummary {
  action: 'APPROVE' | 'REJECT';
  totalRequested: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  items: BatchProcessItemResult[];
  startedAt: string;
  completedAt: string;
  actorName: string;
  rejectionReasonCommon?: string;
  assignedRoleCommon?: Role;
}

export type RegistrationStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'Menunggu Verifikasi'
  | 'Disetujui'
  | 'Ditolak';

export interface RegistrationRequest {
  id: string; // e.g. REG-202610-001
  username?: string;
  fullName: string;
  employeeId: string; // NIP
  corporateEmail: string;
  unitId: string;
  unitName: string;
  unitCode: string;
  unitType?: UnitType;
  position: string; // Jabatan / Peran pekerjaan
  phone?: string;
  passwordHash: string;
  requestedUnitCategory?: 'UPDL' | 'CORPU' | 'NON_UPDL';
  requestedUnitId?: string;
  requestedUnitName?: string;
  isManualUnit?: boolean;
  manualUnitVerified?: boolean;
  agreedToTerms: boolean;
  status: RegistrationStatus;
  rejectionReason?: string;
  assignedRole?: Role;
  submittedAt: string;
  processedAt?: string;
  processedByAdminId?: string;
  processedByAdminName?: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string; // Format: #XXXX-MM-YYYY-NNN
  legacyTicketNumber?: string; // Format lama (misal: TCU-2026-00001) untuk pencarian historis
  title: string;
  description: string;
  type: TicketType;
  categoryId: string;
  categoryName: string;
  categoryCode?: string; // Format: #XXXX-MM-YYYY-NNN
  componentId?: string;
  componentName?: string;
  subcategoryId: string;
  subcategoryName: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  reporterUnitId?: string;
  reporterUnitName?: string;
  reporterUnitCode?: string;
  reporterUnitType?: UnitType | 'UNCLASSIFIED';
  handlingUnitId?: string;
  handlingUnitName?: string;
  department: string;
  location: string;
  assetReference?: string;
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  priority: PriorityLevel;
  status: TicketStatus;
  currentPicId?: string;
  currentPicName?: string;
  currentPicTeam?: string;
  assignedPicId?: string;
  assignedTeam?: string;
  assignmentMethod?: 'auto' | 'manual';
  assignmentStatus?: 'assigned' | 'unassigned' | 'reassigned';
  createdAt: string;
  updatedAt: string;
  assignedAt?: string;
  acceptedAt?: string;
  inProgressAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  dueAt: string; // SLA deadline
  slaResponseDueAt?: string;
  firstResponseAt?: string;
  resolution?: string;
  resolutionProofUrl?: string;
  reopenedCount: number;
  rejectionReason?: string;
  priorityChangeReason?: string;
  tags?: string[];
}

export interface AutoAssignmentRule {
  id: string;
  categoryId: string;
  categoryName: string;
  targetTeam: string;
  defaultPicId?: string;
  defaultPicName?: string;
  loadBalancingStrategy: 'least_active_workload' | 'round_robin' | 'direct_pic';
  isActive: boolean;
  notes?: string;
}

export interface Assignment {
  id: string;
  ticketId: string;
  picId: string;
  picName: string;
  assignedBy: string;
  assignedByName: string;
  assignedAt: string;
  acceptedAt?: string;
  completedAt?: string;
  assignmentStatus: 'pending' | 'accepted' | 'rejected' | 'completed';
  reason?: string;
}

export interface Progress {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  message: string;
  statusBefore?: TicketStatus;
  statusAfter?: TicketStatus;
  visibility: 'public' | 'internal';
  createdAt: string;
}

export interface Comment {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  message: string;
  visibility: 'public' | 'internal';
  createdAt: string;
}

export interface Attachment {
  id: string;
  ticketId: string;
  uploadedBy: string;
  uploadedByName: string;
  fileName: string;
  fileType: string;
  fileSize: number; // in bytes
  storagePath?: string;
  url?: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  ticketId: string;
  ticketNumber: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: string;
  beforeValue?: string;
  afterValue?: string;
  details?: string;
  visibility?: 'public' | 'internal';
  createdAt: string;
}

export interface Category {
  id: string;
  code: string; // Format: #XXXX-MM-YYYY-NNN
  name: string;
  description: string;
  subcategories: string[];
  defaultTeam: string;
  defaultSlaResponseMinutes: number;
  defaultSlaResolveHours: number;
  isActive: boolean;
  createdAt?: string;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  ticketId: string;
  ticketNumber: string;
  title: string;
  message: string;
  isRead: boolean;
  type: 'status' | 'assignment' | 'comment' | 'sla' | 'system' | 'registration';
  createdAt: string;
  registrationDetails?: {
    requestId: string;
    fullName: string;
    employeeId: string;
    corporateEmail: string;
    unitName: string;
    submittedAt: string;
    status: RegistrationStatus;
  };
}

export interface SlaConfig {
  priority: PriorityLevel;
  responseMinutes: number;
  resolveHours: number;
  description: string;
}
