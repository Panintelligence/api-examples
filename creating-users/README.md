# Creating users

In this example, the scenario is:
* I have a collection of user data
* I need to create those users in the dashboard
* I need each user to have some variables set up
* I need each user to have some user restrictions

The data for each user is held inside [user-info.json](./user-info.json) which will then be consumed in order to create matching users in panintelligence.

See the examples below:
* Javascript: [create-users.js](./create-users.js)
  * Run with `node create-users.js`