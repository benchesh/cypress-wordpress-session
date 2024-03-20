Cypress.Commands.add('wordpressSession', (username, password, {
    cookiesFilepath = '.wordpress-login-cookies.json',
    verboseLogging,
    landingPage = '/wp-admin',
    obscurePassword = true,
    sessionOptions = { cacheAcrossSpecs: true }
}) => {
    const {
        name: pkgName,
        version: pkgVersion
    } = require('./package.json');

    const cwsLog = (str) => {
        if (verboseLogging) {
            cy.log(`${pkgName}: ${str}`);
        }
    }

    const cwsErr = (str) => {
        throw new Error(`${pkgName} ERROR: ${str}`)
    }

    if (!username) {
        cwsErr('No username supplied!')
    }

    if (!password) {
        cwsErr('No password supplied!')
    }

    let fullJson = {};
    let currentJsonCookies = [];
    let cookiesFilepathExists = false;

    // Get the current JSON and update currentJsonCookies accordingly
    // When init is true, write these cookies to the browser
    const getCurrentJsonCookies = (init = false) => {
        cy.exec(`echo stdout && [ -f ${cookiesFilepath} ] && echo "Cookie file found"`, { failOnNonZeroExit: false }).then((res) => {
            if (!res.stdout.includes('stdout')) {// if stdout doesn't work, we'll need an alternative method to check the file exists
                cy.writeFile(cookiesFilepath, '', { flag: 'a+' });// ensures cy.readFile won't crash
            } else if (!res.stdout.includes('Cookie file found')) {
                if (init) cwsLog('Wordpress cookie file not found...');

                return;
            }

            cy.readFile(
                cookiesFilepath,
                null//read the file as a buffer, otherwise it will run parse it as if it were JSON, which will cause a crash if it's empty
            ).then((file) => {
                if (!file.length) {// file is empty; act as if it doesn't exist!
                    if (init) cwsLog(`Wordpress cookie file not found ("${cookiesFilepath}")...`);
                    return;
                }

                const thisJson = JSON.parse(file);

                if (pkgVersion !== thisJson.pkgVersion) {
                    if (init) cwsLog(`Wordpress cookie file found at "${cookiesFilepath}", but it's for a different version of ${pkgName}, so will be discarded!`);

                    return;
                }

                fullJson = thisJson;
                cookiesFilepathExists = true;

                if (init) cwsLog('Wordpress cookie file found!');

                if (!fullJson.users || !fullJson.users[username]) {
                    if (init) cwsLog(`No session found for user ${username}`);
                    return;
                }

                currentJsonCookies = fullJson.users[username];

                if (!init) return;

                currentJsonCookies.forEach((cookie) => {
                    const {
                        name, value, domain, httpOnly, path, secure,
                    } = cookie;

                    cy.setCookie(name, value, {
                        domain, httpOnly, path, secure,
                    });
                });
            });
        });
    }

    cy.session([
        username,
        obscurePassword ? password.replace(/./g, '*') : password
    ], () => {
        getCurrentJsonCookies(true);

        cy.visit('/wp-admin');

        cy.url().then((url) => {
            if (url.includes('/wp-admin')) {
                cwsLog('Wordpress session restored successfully!');
            } else if (url.includes('/wp-login')) {
                if (currentJsonCookies) {
                    cwsLog('Session restoration unsuccessful!');
                }

                cwsLog(`Logging in to Wordpress as ${username}...`);

                const inputText = (el, text, enter, isSensitive) => {
                    cy.get(el).should('exist');
                    cy.get(el).clear();
                    cy.get(el).invoke('val').as('currentText');

                    cy.get('@currentText').then((currentText) => {
                        if (currentText !== '') { // workaround for a rare bug
                            // eslint-disable-next-line cypress/no-unnecessary-waiting
                            cy.wait(500);

                            inputText(el, text, enter, isSensitive);
                            return;
                        }

                        Cypress.log({
                            $el: cy.get(el),
                            name: 'type',
                            message: isSensitive ? '*'.repeat(text.length) : text,
                        });

                        cy.get(el).type(
                            `${text}${enter ? '{enter}' : ''}`,
                            { delay: 0, log: false }
                        );
                    });
                };

                inputText('input[name=log]', username);
                inputText('input[name=pwd]', password, true, obscurePassword);

                cy.get('body').then(($body) => {
                    if ($body.find('#login_error').length) {
                        cwsErr('Wordpress login credentials are incorrect!');
                    }
                });
            } else {
                cwsErr('Wordpress login failed!');
            }
        });

        cy.url().should('include', '/wp-admin').then(() => {
            cy.getAllCookies().then((cookies) => {
                const browserLoginCookies = cookies.filter((cookie) => cookie.name.startsWith('wordpress_'));

                if (browserLoginCookies) {
                    getCurrentJsonCookies();//get the JSON file again in case it's already been changed elsewhere!

                    const allLoginCookies = browserLoginCookies.concat(currentJsonCookies).map((cookie) => {
                        const {
                            name, value, domain, httpOnly, secure,
                        } = cookie;

                        return {
                            name, value, domain, httpOnly, secure,
                        };
                    });

                    //get a list of unique domains from all of the cookies
                    const uniqueDomains = [...new Set(allLoginCookies.map((obj) => obj.domain))];

                    const uniqueLoginCookies = [];

                    //Add all of the cookies for every domain to uniqueLoginCookies.
                    //If any two cookies for a domain have the same name, only add the first one it finds.
                    //Due to browserLoginCookies.concat(currentJsonCookies), the most recently saved cookies will always be the first ones.
                    //We can then compare uniqueLoginCookies to currentJsonCookies to see if the cookies have changed.
                    uniqueDomains.forEach((domain) => {
                        const allCookiesForDomain = allLoginCookies.filter((cookie) => cookie.domain === domain)

                        allCookiesForDomain.forEach((cookie) => {
                            if (!uniqueLoginCookies.find((uCookie) => uCookie.name === cookie.name)) {
                                uniqueLoginCookies.push(cookie);
                            }
                        });
                    });

                    //The cookies have changed, so save the new list!
                    if (JSON.stringify(uniqueLoginCookies) !== JSON.stringify(currentJsonCookies)) {
                        cy.writeFile(cookiesFilepath, JSON.stringify({
                            pkgVersion,
                            users: {
                                ...fullJson.users,
                                [username]: uniqueLoginCookies,
                            },
                        }, null, 4));

                        if (cookiesFilepathExists) {
                            cwsLog(`Updated Wordpress cookies file at "${cookiesFilepath}".`);
                        } else {
                            cwsLog(`Saved new Wordpress cookies file at "${cookiesFilepath}".`);
                        }
                    }
                }
            });
        });
    }, sessionOptions);

    if (landingPage) {
        cy.visit(landingPage);

        const urlOrPathIsLoginPage = (urlOrPath) => {
            return new URL(urlOrPath, 'http://test/').pathname.startsWith('/wp-login');
        }

        if (!urlOrPathIsLoginPage(landingPage)) {
            cy.url().then((url) => {
                if (urlOrPathIsLoginPage(url)) {
                    cwsErr(`The session was not restored successfully, as your desired landing page ${landingPage} has instead sent you back to the login screen. The session will now be cleared!`);
                    Cypress.session.clearAllSavedSessions();
                }
            });
        }
    }
});
