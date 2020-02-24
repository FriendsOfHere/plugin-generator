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
  'The root directory in which to create the Here plugin',
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
let extractToSingleFolder = false;

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
          name: 'extractToFolder',
          type: prev => prev && exists && 'confirm',
          message: 'Directory not empty. Extract to a single folder?',
          initial,
        },
      ],
      { onCancel }
    )
  )
  .then(({ verify, extractToFolder }) => {
    if (!verify) return process.exit();
    if (extractToFolder) {
      extractToSingleFolder = extractToFolder;
    }

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
          message: `Identifier ${reset.dim('(ogrName.identifier | authorName.identifier)')}`,
          validate: s =>
            // discussed with Here group, no limit naming convention with `app.here` prefix for now
            // /^app\.here\.([a-zA-Z-]{2,})$/.test(s.trim()) ||
            // Use Java Package Name Style convention
            /^([a-zA-Z-]{2,})(.[a-zA-Z-]{2,}){1,}$/.test(s.trim()) ||
            'Invalid package name format',
          format: s => s.toLowerCase(),
          initial: "com.example.helloworld"
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

    const destDir = extractToSingleFolder ? `${dir}/${data.pluginIdentifier}`: dir
    const boilerplate = path.resolve(__dirname, '../boilerplate/**');

    const mv = (from, to) =>
      fs.move(path.resolve(destDir, from), path.resolve(destDir, to));
    const rename = (from, to) =>
      filesystem.renameSync(path.resolve(destDir, from), path.resolve(destDir, to));
    const del = f => fs.delete(path.resolve(destDir, f));

    fs.copyTpl(boilerplate, destDir, tpl);
    //git stuff
    mv('gitignore', '.gitignore');
    mv('gitattributes', '.gitattributes');

    const license = require(`spdx-license-list/licenses/${data.license}`);
    
    let licenseFilledText = license.licenseText
          .replace("<year>", new Date().getFullYear());
    if (data.authorName != "") {
        licenseFilledText = licenseFilledText.replace("<copyright holders>", data.authorName);
    }

    fs.write(path.resolve(destDir, 'LICENSE.md'), licenseFilledText);

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
