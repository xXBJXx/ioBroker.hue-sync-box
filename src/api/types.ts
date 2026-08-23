export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
    [key: string]: JsonValue | undefined;
}

export interface ApiErrorBody {
    code?: number;
    error?: number;
    message?: string;
}

export interface ApiResponse<T> {
    data?: T;
    errors?: ApiErrorBody[];
}

export interface DeviceResource extends JsonObject {
    name: string;
    type?: string;
    uniqueId: string;
    ipAddress?: string;
    apiLevel?: number;
    firmwareVersion?: string;
    buildNumber?: number;
}

export interface RegistrationResponse extends JsonObject {
    registrationId: string;
    accessToken: string;
}

export interface RootResource extends JsonObject {
    device?: DeviceResource;
    hue?: JsonObject;
    execution?: JsonObject;
    hdmi?: JsonObject;
    behavior?: JsonObject;
    presets?: JsonObject;
    ir?: JsonObject;
}

export type ApiResource = 'device' | 'hue' | 'execution' | 'hdmi' | 'behavior' | 'presets';
export type HttpMethod = 'DELETE' | 'GET' | 'POST' | 'PUT';
