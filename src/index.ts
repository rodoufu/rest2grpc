import * as rest2grpc from './rest2grpcServer';
import {
	ErrorSource,
	Rest2gRPCServer
} from './rest2grpcServer';
import {ErrorHandler} from './errorHandler';
import * as interceptor from './interceptor';
import {Interceptor} from './interceptor';

export {
	rest2grpc,
	ErrorSource,
	Rest2gRPCServer,

	ErrorHandler,

	interceptor,
	Interceptor,
};
