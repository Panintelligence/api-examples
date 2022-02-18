const protocols = {
    'http': require('http'),
    'https': require('https')
};

class DashboardRequest {
    constructor(dashboardInfo) {
        this.host = dashboardInfo.host;
        this.port = dashboardInfo.port;
        this.username = dashboardInfo.username;
        this.password = dashboardInfo.password;
        this.protocol = protocols[dashboardInfo.protocol];
    }

    generic(method, endpoint, headers, jsonData, pathPrefix) {
        const _pathPrefix = pathPrefix || "/pi/api/v2"
        const data = jsonData ? JSON.stringify(jsonData) : "";
        const allHeaders = headers || {};
        allHeaders['accept'] = 'application/json';
        if (data) {
            allHeaders['Content-Type'] = 'application/json';
            allHeaders['Content-Length'] = data.length;
        }
        const options = {
            hostname: this.host,
            path: `${_pathPrefix}${endpoint}`,
            method: method,
            headers: allHeaders
        }
        if (this.port) {
            options["port"] = this.port;
        }

        return new Promise((resolve, reject) => {
            const req = this.protocol.request(options, res => {
                let dataBuffer = "";
                res.on('data', data => {
                    dataBuffer += data || "";
                });
                res.on('close', () => {
                    resolve(dataBuffer ? JSON.parse(dataBuffer) : {});
                });
            });

            req.on('error', error => {
                reject(error);
            });

            req.write(data);
            req.end();
        });
    }

    async get(token, endpoint) {
        return await this.generic('GET',
            endpoint,
            { 'Authorization': `Bearer ${token}` });
    }

    async post(token, endpoint, jsonData) {
        return await this.generic('POST',
            endpoint,
            { 'Authorization': `Bearer ${token}` },
            jsonData);
    }

    async put(token, endpoint, jsonData) {
        return await this.generic('PUT',
            endpoint,
            { 'Authorization': `Bearer ${token}` },
            jsonData);
    }

    async delete(token, endpoint) {
        return await this.generic('DELETE',
            endpoint,
            { 'Authorization': `Bearer ${token}` });
    }

    async getToken() {
        return (await this.generic('POST',
            '/tokens',
            { 'Authorization': `Basic ${this.username}:${this.password}` })).token;
    }

    async getChartJson(token, chartId) {
        return await this.generic('GET',
            `/json?chartId=${chartId}`,
            { 'Authorization': `Bearer ${token}` },
            null,
            "/pi/export");
    }
}

module.exports = DashboardRequest;