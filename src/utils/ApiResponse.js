class ApiResponse {
  constructor(statusCode, data = null, message = 'Success') {
    this.statusCode = statusCode;
    this.message = message;
    if (!!data) {
      this.data = data;
    }
    this.success = statusCode < 400;
  }
}

export default ApiResponse;
