declare module "@huggingface/transformers" {
  export const env: {
    allowLocalModels: boolean;
    useBrowserCache: boolean;
  };

  export class RawImage {
    constructor(data: Uint8ClampedArray, width: number, height: number, channels: number);
  }

  export class AutoModel {
    static from_pretrained(
      model_id: string,
      options?: {
        device?: string;
        progress_callback?: (progress: any) => void;
        session_options?: { logSeverityLevel: number };
      }
    ): Promise<any>;
  }

  export class AutoProcessor {
    static from_pretrained(model_id: string): Promise<any>;
  }
}
