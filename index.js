Cypress.Commands.add('wordpressSession', (username, password, {
    cookiesFilepath = '.wordpress-login-cookies.json',
    verboseLogging,
    landingPage = '/wp-admin',
    obscurePassword = true,
}) => {
    if (!username) {
        throw new Error('cypress-wordpress-session: No username supplied!')
    }

    if (!password) {
        throw new Error('cypress-wordpress-session: No password supplied!')
    }

    let savedLoginCookies = [];
    let cookiesFilepathExists = false;

    cy.session([
        username,
        obscurePassword ? password.replace(/./g, '*') : password
    ], () => {
        cy.exec(`[ -f ${cookiesFilepath} ] && echo "Cookie file found"`, { failOnNonZeroExit: false }).then((res) => {
            if (res.stdout === 'Cookie file found') {
                cookiesFilepathExists = true;

                verboseLogging && cy.log('cypress-wordpress-session: Wordpress cookie file found');

                cy.readFile(cookiesFilepath).then((arr) => {
                    savedLoginCookies = arr;

                    arr.forEach((cookie) => {
                        const {
                            name, value, domain, httpOnly, secure,
                        } = cookie;

                        cy.setCookie(name, value, {
                            domain, httpOnly, secure, path: '/wp-admin',
                        });
                    });
                });
            }
        });

        cy.visit('/wp-admin');

        cy.url().then((url) => {
            if (url.includes('/wp-admin')) {
                verboseLogging && cy.log('cypress-wordpress-session: Wordpress session restored successfully');
            } else if (url.includes('/wp-login')) {
                verboseLogging && cy.log('cypress-wordpress-session: Logging in to wordpress...');

                cy.wait(500); // make sure input box is loaded before we type. TODO: improve this
                cy.get('input[name=log]').should('exist').type(username, { delay: 0 });
                cy.get('input[name=pwd]').should('exist').type(`${password}{enter}`, { delay: 0 });
                cy.get('body').then(($body) => {
                    if ($body.find('#login_error').length) {
                        throw new Error('cypress-wordpress-session: Wordpress login credentials are incorrect!');
                    }
                });
            } else {
                throw new Error('cypress-wordpress-session: Wordpress login failed!');
            }
        });

        cy.url().should('include', '/wp-admin').then(() => {
            cy.getAllCookies().then((cookies) => {
                const browserLoginCookies = cookies.filter((cookie) => cookie.name.startsWith('wordpress_sec'));

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
                        uniqueLoginCookies.push(
                            allLoginCookies.find((cookie) => cookie.domain === domain),
                        );
                    });

                    if (JSON.stringify(uniqueLoginCookies) !== JSON.stringify(savedLoginCookies)) {
                        cy.writeFile(cookiesFilepath, JSON.stringify(uniqueLoginCookies, null, 4));

                        if (verboseLogging) {
                            if (cookiesFilepathExists) {
                                cy.log('cypress-wordpress-session: Updaated Wordpress cookies file');
                            } else {
                                cy.log('cypress-wordpress-session: Saved new Wordpress cookies file');
                            }
                        }
                    }
                }
            });
        });
    });

    if (landingPage) {
        cy.visit(landingPage);
    }
});
