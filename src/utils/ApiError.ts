class ApiError extends Error {
    statusCode: number;
    success: boolean;
    errors: any[];

    constructor(statusCode: number, message: string = 'Something went wrong', errors: any[] = [], stack = '') {
        super(message);

        this.statusCode = statusCode;
        this.success = false;
        this.errors = errors;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export { ApiError };
