export interface PendingHighlight {
	text: string;
	prefix?: string;
	suffix?: string;
	occurrence?: number;
	expiresAt: number;
	scroll: boolean;
}
