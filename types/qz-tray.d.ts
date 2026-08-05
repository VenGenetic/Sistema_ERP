/**
 * Minimal ambient typing for the `qz-tray` package (no official/community
 * @types package exists). Only the surface actually used by
 * utils/qzTray.ts is typed; everything else falls back to `any`.
 */
declare module 'qz-tray' {
    interface QzConfig {
        [key: string]: any;
    }

    interface QzPrintDataItem {
        type: 'raw' | 'pixel';
        format?: string;
        flavor?: string;
        data: string;
        options?: Record<string, any>;
    }

    const qz: {
        security: {
            setCertificatePromise: (promiseHandler: (resolve: (value?: any) => void, reject?: (reason?: any) => void) => void) => void;
            setSignaturePromise: (promiseFactory: (toSign: string) => (resolve: (value?: any) => void, reject?: (reason?: any) => void) => void) => void;
        };
        websocket: {
            connect: (options?: Record<string, any>) => Promise<void>;
            disconnect: () => Promise<void>;
            isActive: () => boolean;
        };
        printers: {
            find: (query?: string) => Promise<string | string[]>;
            getDefault: () => Promise<string>;
            details: () => Promise<any>;
        };
        configs: {
            create: (printer: string, options?: Record<string, any>) => QzConfig;
        };
        print: (config: QzConfig, data: Array<QzPrintDataItem | string>) => Promise<void>;
    };

    export default qz;
}
