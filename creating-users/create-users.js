const DashboardRequest = require('../common-js/dashboard-request');
const dashboardInfo = require('./dashboard.json');
const userInfo = require('./user-info.json');

const userTypeToTypeID = {
    "Administrator": 0,
    "Designer": 1,
    "Chart Explorer": 2,
    "User": 3,
    "Chart Viewer": 4
}

const dashboardRequest = new DashboardRequest(dashboardInfo);

const generatePassword = (length) => {
    const charset = `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!`;
    let password = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
        password += charset.charAt(Math.floor(Math.random() * n));
    }
    return password;
}

const extractUserData = (allUserInfo) => {
    return Object.keys(allUserInfo).map(username => {
        return {
            email: allUserInfo[username].email,
            parentId: 1, // super admin
            surname: allUserInfo[username].surnames,
            forenames: allUserInfo[username].forenames,
            userTypeId: userTypeToTypeID[allUserInfo[username].type],
            usercode: username,
            clientPassword: generatePassword(16),
            lite: false
        }
    });
}

const reIndexUserDataByID = (allUserInfo, userIdMap) => {
    return Object.keys(allUserInfo)
        .reduce((userVariables, username) => {
            userVariables[userIdMap[username.toUpperCase()]] = allUserInfo[username];
            return userVariables;
        }, {});
}

const extractVariables = (indexedUserData) => {
    return Object.keys(indexedUserData)
        .map((userId) => {
            return Object.keys(indexedUserData[userId].variables)
                .map(name => {
                    return {
                        userId: Number(`${userId}`),
                        name,
                        value: indexedUserData[userId].variables[name]
                    }
                });
        }).flat();
}

const extractRestrictions = (indexedUserData) => {
    return Object.keys(indexedUserData).map(userId => {
        return Object.keys(indexedUserData[userId].restrictions || []).map(objectName => {
            return {
                userId: Number(`${userId}`),
                columnId: objectName,
                value: indexedUserData[userId].restrictions[objectName]
            }
        });
    }).flat();
}

const replaceRestrictionColumnIds = (restrictions, fullDataConnections) => {
    return restrictions
        .map(restriction => {
            const [dataConnectionName, columnName] = restriction.columnId.split(".");
            const dataConnection = fullDataConnections.find(connection => connection.name === dataConnectionName);
            const allColumns = dataConnection.tables.map(table => table.columns).flat();
            const column = allColumns.find(column => column.displayName === columnName );
            restriction.columnId = column.id;
            return restriction;
        });
}

const collectDataConnections = async (token) => {
    const dataConnections = await dashboardRequest.get(token, `/dataConnections`);
    return await Promise.all(dataConnections.map(async connection => {
        const tables = await dashboardRequest.get(token, `/dataConnections/${connection.id}/tables`);
        connection.tables = await Promise.all(tables.map(async table => {
            table.columns = await dashboardRequest.get(token, `/dataConnections/${connection.id}/tables/${table.id}/columns`);
            return table;
        }));
        return connection;
    }));
}

const createUsersWithInfo = async (allUserInfo) => {
    console.log("Starting...");
    // The first thing we need to do is authenticate with the dashboard.
    // For that we need a token

    console.log("Getting token...");
    const token = await dashboardRequest.getToken();

    // Lets turn the user data into a format that the Panintelligence Dashboard APIv2 likes

    console.log("Extracting user data...");
    const userData = extractUserData(allUserInfo);

    // Then lets create those users

    console.log("Creating users...");
    const dashboardUsers = await Promise.all(userData.map(async (userDetails) => {
        try {
            return await dashboardRequest.post(token, '/users', userDetails);
        } catch (e) {
            console.error(e);
        }
    }));

    console.log("Processing created users...");
    // Now lets relate the new IDs of the users we've made to the data we've got
    const usernameToUserId = Object.fromEntries(dashboardUsers.map(userData => [userData.usercode, userData.id]));

    // And now we can reindex the data we have by the IDs.
    // This is useful so we can do things with these users later.
    const idIndexedUserData = reIndexUserDataByID(allUserInfo, usernameToUserId);

    // After, we can grab the variables and pair them with the correct user ID.
    console.log("Extracting variables...");
    const userVariables = extractVariables(idIndexedUserData);

    // Lets make the global version of those variables too.
    // This way we can easily detect when someone doesn't have a variable set up.
    const globalVariables = [...new Set(userVariables.map(variableInfo => variableInfo.name))]
        .map(name => {
            return {
                userId: 0,
                name,
                value: "to be defined"
            };
        });

    // Now we create those global variables in the Dashboard
    console.log("Creating global variables...");
    await Promise.all(globalVariables.map(async (variableDetails) => {
        try {
            return await dashboardRequest.post(token, '/variables', variableDetails);
        } catch (e) {
            console.error(e);
        }
    }));

    // Now we create those variables in the Dashboard
    console.log("Creating user variables...");
    await Promise.all(userVariables.map(async (variableDetails) => {
        try {
            return await dashboardRequest.post(token, `/users/${variableDetails.userId}/variables`, variableDetails);
        } catch (e) {
            console.error(e);
        }
    }));

    // Before we add the user restrictions, we need to find out the column ID because the data mentions the data connection name and the column name
    // For that we need to get all the data connections and all the tables and all the columns until there's a standalon /columns endpoint.
    console.log("Grabbing data connections...");
    const fullDataConnections = await collectDataConnections(token);

    // Now we can process the user restrictions
    // We'll need to assign them with correct user id, like we did with variables
    console.log("Extracting restrictions...");
    const userRestrictions = extractRestrictions(idIndexedUserData);
    const replacedUserRestrictions = replaceRestrictionColumnIds(userRestrictions, fullDataConnections);
    // Finally, we create those user restrictions in the Dashboard
    console.log("Creating user restrictions...");
    await Promise.all(replacedUserRestrictions.map(async (restrictionDetails) => {
        try {
            return await dashboardRequest.post(token, `/users/${restrictionDetails.userId}/restrictions`, restrictionDetails);
        } catch (e) {
            console.error(e);
        }
    }));
    console.log("Done.");
}

createUsersWithInfo(userInfo);