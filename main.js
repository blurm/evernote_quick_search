$(document).ready( () => {
    var controller = new Controller();
    $('#login').click(() => controller.loginWithEvernote());
    $('#logout').click(() => controller.logout());

    console.log('ready');
    const eomnibar = new Eomnibar(controller);
} );

