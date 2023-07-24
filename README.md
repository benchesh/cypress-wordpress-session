# cypress-wordpress-session

This module can be used to restore a Wordpress session in Cypress by automatically saving Wordpress login cookies to a file.

By default, it'll save the cookies to an invisible JSON file with path `.wordpress-login-cookies.json`. Only relevant cookie data will be saved. If you're using git, it'd probably be a good idea to add this path to your `.gitignore` file for security reasons!

If the file exists, this module will access it to restore your session. If the file doesn't exist or the cookie is invalid, it will attempt to login from scratch.

If you've already configured your Cypress project to navigate to Wordpress, you just need to import this module, supply login credentials and it'll handle the rest for you.

For example:

```javascript
import 'cypress-wordpress-session';

const username = 'admin';
const password = '123';

const options = {};

describe('Admin: article', () => {
  beforeEach(() => {
    cy.wordpressSession(username, password, options);
  });

  it('does something in wordpress', () => {
    // test code here
  });
});
```

The only required parameters are `username` and `password`.

## Parameters

| Name        | Type                                       | Default value       | Description                         |
| ----------- | ------------------------------------------ | ------------------- | ----------------------------------- |
| `username`  | string                                     | undefined           | Wordpress username                  |
| `password`  | string                                     | undefined           | Wordpress password                  |
| `options`   | object                                     | see table below     | Various options, see table below    |

### Options

| Name              | Type    | Default value                   | Description                                                                                                            |
| ----------------- | ------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `cookiesFilepath` | string  | `.wordpress-login-cookies.json` | The location at which the cookies are saved & restored                                                                 |
| `verboseLogging`  | boolean | false                           | Enable verbose logging                                                                                                 |
| `landingPage`     | string  | `/wp-admin`                     | The page to land on once logged in or once the session has been restored. Can be set to a falsy value to prevent this. |
| `obscurePassword` | boolean | true                            | Hide the password from the session parameters, thus preventing it from being easily viewable in the Cypress GUI        |
| `sessionOptions`  | object  | { cacheAcrossSpecs: true }      | Cypress session options (see [Cypress docs](https://docs.cypress.io/api/commands/session))                             |
