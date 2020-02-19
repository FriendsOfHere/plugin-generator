#!/usr/bin/env node

const path = require('path');
const filesystem = require('fs');
const args = require('args');
const prompts = require('prompts');
const memFs = require('mem-fs');
const editor = require('mem-fs-editor');
const yosay = require('yosay');
const ora = require('ora');
const { reset } = require('chalk');
const updateNotifier = require('update-notifier');
const pkg = require('../package.json');

const licenseList = Array.from(require('spdx-license-list/simple'));

args.option(
  'path',
  'The root directory in which to create the Flarum extension',
  process.cwd(),
  p => path.resolve(p)
);

const flags = args.parse(process.argv);
const dir = (args.sub[0] && path.resolve(args.sub[0])) || flags.path;
const store = memFs.create();
const fs = editor.create(store);

const onCancel = () => process.exit();
const initial = true;
let spinner;

updateNotifier({pkg}).notify();

console.log(yosay(`Welcome to a Here plugin generator(V${pkg.version})\n\n- FriendsOfHere`));

new Promise((resolve, reject) => {
  spinner = ora('Starting...').start();
  filesystem.readdir(dir, (err, files = []) => {
    spinner.stop();
    resolve((!err || err.code !== 'ENOENT') && files.length !== 0);
  });
})
  .then(exists =>
    prompts(
      [
        {
          name: 'verify',
          type: 'confirm',
          message: `Write to ${dir}`,
          initial,
        },
        {
          name: 'overwrite',
          type: prev => prev && exists && 'confirm',
          message: 'Directory not empty. Overwrite?',
        },
      ],
      { onCancel }
    )
  )
  .then(({ verify, overwrite }) => {
    if (!verify || overwrite === false) return process.exit();

    if (overwrite) fs.delete(dir);

    process.stdout.write('\n');

    return prompts(
      [
        {
          name: 'pluginName',
          type: 'text',
          message: 'Plugin name',
          validate: str => !!str.trim() || 'The plugin name is required',
        },
        {
          name: 'pluginIdentifier',
          type: 'text',
          message: `Identifier ${reset.dim('(app.here.identifier)')}`,
          validate: s =>
            // discussed with Here group, no limit naming convention with `app.here` prefix for now
            // /^app\.here\.([a-zA-Z-]{2,})$/.test(s.trim()) ||
            // Use Java Package Name Style convention
            /^([a-zA-Z-]{2,}).([a-zA-Z-]{2,}).([a-zA-Z-]{2,})$/.test(s.trim()) ||
            'Invalid package name format',
          format: s => s.toLowerCase(),
          initial: "app.here.helloworld"
        },
        {
          name: 'pluginDescription',
          type: 'text',
          message: 'Plugin description',
        },
        {
          name: 'authorName',
          type: 'text',
          message: 'Author name',
        },
        {
          name: 'authorWebsite',
          type: 'text',
          message: 'Author website',
          validate: s =>
            !s ||
            /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/
            .test(
              s
            ) ||
            'Invalid url format',
        },
        {
            type: 'select',
            name: 'defaultCategory',
            message: 'Select a defaultCategory',
            choices: [
                { title: 'Fav', description: 'fav category', value: 'fav' },
                { title: 'News', description: 'news category', value: 'news' },
                { title: 'Quick', description: 'quick category', value: 'quick' },
            ]
        },
        {
          type: 'multiselect',
          name: 'renderComponents',
          message: 'Pick render components',
          choices: [
            { title: 'Mini window', value: 'mini', selected: true },
            { title: 'Menu bar', value: 'menuBar', selected: true },
            { title: 'Dock', value: 'dock', selected: true }
          ],
          hint: '- Space to select. Return to submit'
        },
        {
          name: 'license',
          type: 'autocomplete',
          message: 'License',
          choices: licenseList.map(e => ({ title: e })),
          initial: "MIT"
        },
      ],
      { onCancel }
    );
  })

  .then(data => {
    process.stdout.write('\n');
    spinner = ora('Setting up plugin...').start();

    const tpl = Object.assign(data, {
      year: new Date().getFullYear(),
    });

    const mv = (from, to) =>
      fs.move(path.resolve(dir, from), path.resolve(dir, to));
    const rename = (from, to) =>
      filesystem.renameSync(path.resolve(dir, from), path.resolve(dir, to));
    const del = f => fs.delete(path.resolve(dir, f));
    const boilerplate = path.resolve(__dirname, '../boilerplate/**');

    fs.copyTpl(boilerplate, dir, tpl);
    //git stuff
    mv('gitignore', '.gitignore');
    mv('gitattributes', '.gitattributes');

    const license = require(`spdx-license-list/licenses/${data.license}`);
    
    let licenseFilledText = license.licenseText
          .replace("<year>", new Date().getFullYear());
    if (data.authorName != "") {
        licenseFilledText = licenseFilledText.replace("<copyright holders>", data.authorName);
    }

    fs.write(path.resolve(dir, 'LICENSE.md'), licenseFilledText);

    return new Promise((resolve, reject) => {
      fs.commit(err => {
        if (err) return reject(err);
        resolve();
      });
    });
  })
  .then(() => {
    spinner.succeed(`Successfully set up Here plugin in ${dir}`);
  })
  .catch(err => {
    if (spinner) spinner.fail();
    console.error(err);
  });
