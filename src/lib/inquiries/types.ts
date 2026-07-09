export interface Inquiry {
  id: string;
  name: string;
  phone: string;
  message: string;
  sceneId?: string;
  sceneName?: string;
  zoneSummary?: string;
  createdAt: string;
}

export interface InquiryRegistry {
  inquiries: Inquiry[];
}
