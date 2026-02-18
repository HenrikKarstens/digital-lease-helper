export type DocType = 'main-contract' | 'amendment' | 'handover-protocol' | 'utility-bill';

export interface DocStep {
  id: DocType;
  title: string;
  subtitle: string;
  icon: string;
  optional: boolean;
  relevantFor?: 'move-in' | 'move-out' | 'both';
}

export interface PagePhoto {
  id: string;
  dataUrl: string;
  mimeType: string;
  file: File;
}

export type InputMode = 'idle' | 'camera' | 'upload' | 'manual' | 'analyzing' | 'done';
