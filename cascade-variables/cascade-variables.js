const DashboardRequest = require('../common-js/dashboard-request');
const dashboardInfo = require('./dashboard.json');
const userInfo = require('./user-info.json');

const dashboardRequest = new DashboardRequest(dashboardInfo);

const fetchVariablesForUsers = async (token, user) => {
    if (user.children.length > 0) {
        for (let i = 0; i < user.children.length; i++) {
            await fetchVariablesForUsers(token, user.children[i]);
        }
    }
    user.variables = await dashboardRequest.get(token, `/users/${user.id}/variables`);
}

const getHierarchicalUserData = async (token) => {
    const users = await dashboardRequest.get(token, "/users");
    users.forEach(user => {
        user.children = users.filter(u => u.parentId === user.id)
    });
    return users.find(u => u.id === userInfo.parentUserId);
}

const flagMissingVariables = (user, parent) => {
    const userVariableNames = user.variables.map(uv => uv.name)
    const parentMissingVariableNames = parent ? parent.missingVariables.map(uv => uv.name) : []
    const missingVariables = parent ? [...(parent.missingVariables || []), ...parent.variables.filter(pv => !userVariableNames.includes(pv.name) && !parentMissingVariableNames.includes(pv.name))] : []
    user.missingVariables = [...new Set(missingVariables)];
    user.children.forEach(child => flagMissingVariables(child, user));
}

const updateUserVariables = async (token, user) => {
    try {
        if(user.missingVariables.length){
            console.log(`Applying ${user.missingVariables.length} missing variables for ${user.usercode}...`)
            for (let i = 0; i < user.missingVariables.length; i++) {
                await dashboardRequest.post(token, `/users/${user.id}/variables`, {
                    "userId": user.id,
                    "name": user.missingVariables[i].name,
                    "value": user.missingVariables[i].value,
                    "isSecure": user.missingVariables[i].isSecure
                });
            }
        }
        for (let i = 0; i < user.children.length; i++) {
            await updateUserVariables(token, user.children[i]);
        }
    } catch (e) {
        console.error(e);
    }
}

const cascadeVariables = async () => {
    console.log("Getting token...");
    const token = await dashboardRequest.getToken();
    console.log("Organising users in a hierarchy...");
    const parentUser = await getHierarchicalUserData(token);
    console.log("Fetching variables...");
    await fetchVariablesForUsers(token, parentUser);
    console.log("Finding missing variables in children...");
    flagMissingVariables(parentUser);
    console.log("Updating variables...");
    await updateUserVariables(token, parentUser);
    console.log("Done!")
}

cascadeVariables();