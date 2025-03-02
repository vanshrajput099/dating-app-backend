class APIResponse {
    constructor(statusCode, message, data = null) {
        this.message = message;
        this.statusCode = statusCode;
        this.data = data;
    }
}

export default APIResponse;