sap.ui.define([], function () {
    "use strict";

    const BASE = "/odata/v4/purchase-order-service";

    let csrfToken = null;


    /* =========================================================
       CHECK WHETHER RUNNING LOCALLY
       ========================================================= */

    function isLocal() {

        const hostname =
            window.location.hostname;

        return (
            hostname === "localhost" ||
            hostname === "127.0.0.1"
        );
    }


    /* =========================================================
       FETCH CSRF TOKEN
       ========================================================= */

    async function fetchCsrfToken() {

        const response =
            await fetch(
                BASE + "/",
                {
                    method: "GET",
                    headers: {
                        "Accept": "application/json",
                        "X-CSRF-Token": "Fetch"
                    }
                }
            );


        const token =
            response.headers.get(
                "X-CSRF-Token"
            );


        if (!response.ok) {

            throw new Error(
                `Unable to obtain CSRF token. HTTP ${response.status}`
            );
        }


        /*
         * Local CAP may not return a CSRF token.
         * This is acceptable because local testing
         * does not go through the App Router CSRF
         * protection.
         */

        if (!token) {

            return null;
        }


        csrfToken = token;

        return csrfToken;
    }


    /* =========================================================
       GET CSRF TOKEN
       ========================================================= */

    async function getCsrfToken() {

        /*
         * Local CAP server:
         * no App Router CSRF protection is involved.
         */

        if (isLocal()) {
            return null;
        }


        if (csrfToken) {
            return csrfToken;
        }


        return await fetchCsrfToken();
    }


    /* =========================================================
       HTTP REQUEST
       ========================================================= */

    async function request(
        path,
        options = {},
        retry = true
    ) {

        const method =
            options.method || "GET";


        const headers =
            Object.assign(
                {
                    "Accept":
                        "application/json",
                    "Content-Type":
                        "application/json"
                },
                options.headers || {}
            );


        /*
         * Add CSRF token only for
         * write operations.
         */

        if (
            method !== "GET" &&
            method !== "HEAD" &&
            method !== "OPTIONS"
        ) {

            const token =
                await getCsrfToken();


            if (token) {

                headers["X-CSRF-Token"] =
                    token;
            }
        }


        const response =
            await fetch(
                BASE + path,
                Object.assign(
                    {},
                    options,
                    {
                        headers:
                            headers
                    }
                )
            );


        /*
         * In the deployed App Router,
         * retry once if the CSRF token has expired.
         */

        if (
            response.status === 403 &&
            !isLocal() &&
            method !== "GET" &&
            method !== "HEAD" &&
            method !== "OPTIONS" &&
            retry
        ) {

            csrfToken = null;


            const newToken =
                await fetchCsrfToken();


            if (newToken) {

                return await request(
                    path,
                    options,
                    false
                );
            }
        }


        const text =
            await response.text();


        let body = null;


        try {

            body =
                text
                    ? JSON.parse(text)
                    : null;

        } catch (_) {

            body = text;
        }


        if (!response.ok) {

            const msg =
                body?.error?.message ||
                body?.message ||
                `HTTP ${response.status}`;


            throw new Error(msg);
        }


        return body;
    }


    /* =========================================================
       ESCAPE ODATA STRING
       ========================================================= */

    const esc = value =>
        String(value)
            .replace(/'/g, "''");


    /* =========================================================
       PUBLIC API
       ========================================================= */

    return {

        /* GET COLLECTION */

        list: function (entity) {

            return request(
                `/${entity}`
            );
        },


        /* GET SINGLE ENTITY */

        get: function (
            entity,
            key
        ) {

            return request(
                `/${entity}(${encodeURIComponent(key)})`
            );
        },


        /* QUERY */

        query: function (
            entity,
            query
        ) {

            return request(
                `/${entity}${
                    query
                        ? "?" + query
                        : ""
                }`
            );
        },


        /* CREATE */

        create: function (
            entity,
            data
        ) {

            return request(
                `/${entity}`,
                {
                    method: "POST",
                    body:
                        JSON.stringify(data)
                }
            );
        },


        /* UPDATE */

        patch: function (
            entity,
            key,
            data
        ) {

            return request(
                `/${entity}(${encodeURIComponent(key)})`,
                {
                    method: "PATCH",
                    body:
                        JSON.stringify(data)
                }
            );
        },


        /* DELETE */

        remove: function (
            entity,
            key
        ) {

            return request(
                `/${entity}(${encodeURIComponent(key)})`,
                {
                    method: "DELETE"
                }
            );
        },


        /* ACTION */

        action: function (
            name,
            data
        ) {

            return request(
                `/${name}`,
                {
                    method: "POST",
                    body:
                        JSON.stringify(data)
                }
            );
        },


        /* ODATA STRING ESCAPE */

        key: esc
    };
});