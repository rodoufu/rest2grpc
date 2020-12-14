import {ErrorSource} from "./rest2grpcServer";

export interface ErrorHandler {
	handle(source: ErrorSource, error: any): boolean;
}
