class ApiResponse<T = null> {
  statusCode: number;
  data?: T;
  message: string;
  success: boolean;
  constructor(statusCode: number, data?: T, message: string = 'Success') {
    this.statusCode = statusCode;
    this.message = message;
    if (data !== undefined) this.data = data;
    this.success = statusCode < 400;
  }
}

export default ApiResponse;
