# Cascade Variables

In this example, the scenario is:
* I have a number of users in a hierarchy
* I need to ensure all users below the given user have the same variables

The data for the parent user ID to start with is in [user-info.json](./user-info.json) which will then be consumed in order to get all users and organise those under the chosen parent them in a hierarchical manner.

See the examples below:
* Javascript: [cascade-variables.js](./cascade-variables.js)
  * Run with `node cascade-variables.js`