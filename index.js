Cypress.Commands.add('wordpressSession', (username, password, {
    cookiesFilepath = '.wordpress-login-cookies.json',
    verboseLogging,
    landingPage = '/wp-admin',
    obscurePassword = true,
    sessionOptions = { cacheAcrossSpecs: true }
}) => {
    const cwsLog = (str) => {
        if (verboseLogging) {
            cy.log(`cypress-wordpress-session: ${str}`);
        }
    }

    const cwsErr = (str) => {
        throw new Error(`cypress-wordpress-session ERROR: ${str}`)
    }

    if (!username) {
        cwsErr('No username supplied!')
    }

    if (!password) {
        cwsErr('No password supplied!')
    }

    let savedLoginCookies = [];
    let cookiesFilepathExists = false;

    cy.session([
        username,
        obscurePassword ? password.replace(/./g, '*') : password
    ], () => {
        cy.exec(`echo stdout && [ -f ${cookiesFilepath} ] && echo "Cookie file found"`, { failOnNonZeroExit: false }).then((res) => {
            if (!res.stdout.includes('stdout')) {// if stdout doesn't work, we'll need an alternative method to check the file exists
                cy.writeFile(cookiesFilepath, '', { flag: 'a+' });// ensures cy.readFile won't crash
            } else if (!res.stdout.includes('Cookie file found')) {
                cwsLog('Wordpress cookie file not found...');

                return;
            }

            cy.readFile(
                cookiesFilepath,
                null//read the file as a buffer, otherwise it will run parse it as if it were JSON, which will cause a crash if it's empty
            ).then((file) => {
                if (!file.length) {// file is empty; act as if it doesn't exist!
                    cwsLog('Wordpress cookie file not found...');
                    return;
                }

                cookiesFilepathExists = true;

                cwsLog('Wordpress cookie file found!');

                savedLoginCookies = JSON.parse(file);

                savedLoginCookies.forEach((cookie) => {
                    const {
                        name, value, domain, httpOnly, path, secure,
                    } = cookie;

                    cy.setCookie(name, value, {
                        domain, httpOnly, path, secure,
                    });
                });
            });
        });

        cy.visit('/wp-admin');

        cy.url().then((url) => {
            if (url.includes('/wp-admin')) {
                cwsLog('Wordpress session restored successfully!');
            } else if (url.includes('/wp-login')) {
                if (cookiesFilepathExists) {
                    cwsLog('Session restoration unsuccessful!');
                }

                cwsLog('Logging in to wordpress...');

                cy.wait(500); // make sure input box is loaded before we type. TODO: improve this
                cy.get('input[name=log]').should('exist').clear().type(username, { delay: 0 });
                cy.get('input[name=pwd]').should('exist').clear().type(`${password}{enter}`, { delay: 0 });
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
                    const allLoginCookies = browserLoginCookies.concat(savedLoginCookies).map((cookie) => {
                        const {
                            name, value, domain, httpOnly, secure,
                        } = cookie;

                        return {
                            name, value, domain, httpOnly, secure,
                        };
                    });

                    const uniqueDomains = [...new Set(allLoginCookies.map((obj) => obj.domain))];

                    const uniqueLoginCookies = [];

                    uniqueDomains.forEach((domain) => {
                        const allCookiesForDomain = allLoginCookies.filter((cookie) => cookie.domain === domain)

                        allCookiesForDomain.forEach((cookie) => {
                            if (!uniqueLoginCookies.find((uCookie) => uCookie.name === cookie.name)) {
                                uniqueLoginCookies.push(cookie);
                            }
                        });
                    });

                    if (JSON.stringify(uniqueLoginCookies) !== JSON.stringify(savedLoginCookies)) {
                        cy.writeFile(cookiesFilepath, JSON.stringify(uniqueLoginCookies, null, 4));

                        if (cookiesFilepathExists) {
                            cwsLog('Updated Wordpress cookies file.');
                        } else {
                            cwsLog('Saved new Wordpress cookies file.');
                        }
                    }
                }
            });
        });
    }, sessionOptions);

    if (landingPage) {
        cy.visit(landingPage);
    }
});
