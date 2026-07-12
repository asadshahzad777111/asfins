export type InquiryStatus = "new" | "read" | "replied" | "archived";
export type InquirySource = "contact" | "studio" | "whatsapp" | "other";

export interface Inquiry {
  id: string;
  name: string;
  phone: string;
  email?: string;
  message: string;
  source?: InquirySource;
  status?: InquiryStatus;
  sceneId?: string;
  sceneName?: string;
  zoneSummary?: string;
  createdAt: string;
  updatedAt?: string;
  staffNote?: string;
}

export interface InquiryRegistry {
  inquiries: Inquiry[];
}
