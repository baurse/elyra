/*
 * Copyright 2018-2021 Elyra Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

describe('Pipeline Editor tests', () => {
  beforeEach(() => {
    cy.deleteFile('helloworld.yaml');
    cy.deleteFile('*.pipeline'); // delete pipeline files used for testing

    cy.bootstrapFile('invalid.pipeline');
    cy.bootstrapFile('helloworld.pipeline');
    cy.bootstrapFile('helloworld.ipynb');
    cy.exec('jupyter trust build/cypress-tests/helloworld.ipynb');
    cy.bootstrapFile('helloworld.py');
    cy.bootstrapFile('helloworld.r');

    cy.resetJupyterLab();
  });

  afterEach(() => {
    cy.deleteFile('helloworld.ipynb'); // delete notebook file used for testing
    cy.deleteFile('helloworld.py'); // delete python file used for testing
    cy.deleteFile('output.txt'); // delete output files generated by tests
    cy.deleteFile('*.pipeline'); // delete pipeline files used for testing
    cy.deleteFile('helloworld.yaml');

    // delete runtime configuration used for testing
    cy.exec('elyra-metadata remove runtimes --name=test_runtime', {
      failOnNonZeroExit: false
    });
  });

  // TODO: Fix Test is actually failing
  // it('empty editor should have disabled buttons', () => {
  //   cy.focusPipelineEditor();

  //   const disabledButtons = [
  //     '.run-action',
  //     '.export-action',
  //     '.clear-action',
  //     '.undo-action',
  //     '.redo-action',
  //     '.cut-action',
  //     '.copy-action',
  //     '.paste-action',
  //     '.deleteSelectedObjects-action',
  //     '.arrangeHorizontally-action',
  //     '.arrangeVertically-action'
  //   ];
  //   checkDisabledToolbarButtons(disabledButtons);

  //   const enabledButtons = [
  //     '.save-action',
  //     '.openRuntimes-action',
  //     '.createAutoComment-action'
  //   ];
  //   checkEnabledToolbarButtons(enabledButtons);

  //   closePipelineEditor();
  // });

  it('populated editor should have enabled buttons', () => {
    cy.createPipeline();

    cy.checkTabMenuOptions('Pipeline');

    cy.addFileToPipeline('helloworld.ipynb'); // add Notebook
    cy.addFileToPipeline('helloworld.py'); // add Python Script
    cy.addFileToPipeline('helloworld.r'); // add R Script

    // check buttons
    const disabledButtons = [/redo/i, /cut/i, /copy/i, /paste/i, /delete/i];
    checkDisabledToolbarButtons(disabledButtons);

    const enabledButtons = [
      /run pipeline/i,
      /save pipeline/i,
      /export pipeline/i,
      /clear/i,
      /open runtimes/i,
      /undo/i,
      /add comment/i,
      /arrange horizontally/i,
      /arrange vertically/i
    ];
    checkEnabledToolbarButtons(enabledButtons);
  });

  it('should open notebook on double-click', () => {
    cy.createPipeline();

    cy.addFileToPipeline('helloworld.ipynb'); // add Notebook

    // Open notebook with double-click
    cy.get('#jp-main-dock-panel').within(() => {
      cy.findByText('helloworld.ipynb').dblclick();
    });

    cy.findAllByRole('tab', { name: 'helloworld.ipynb' }).should('exist');
  });

  it('should save runtime configuration', () => {
    cy.createPipeline();

    // Create runtime configuration
    cy.createRuntimeConfig();

    // validate it is now available
    cy.get('#elyra-metadata\\:runtimes').within(() => {
      cy.findByText(/test runtime/i).should('exist');
    });
  });

  it('should fail to run invalid pipeline', () => {
    // opens pipeline from the file browser
    cy.openFile('invalid.pipeline');

    // try to run invalid pipeline
    cy.findByRole('button', { name: /run pipeline/i }).click();

    cy.findByText(/failed run:/i).should('be.visible');
  });

  it('should run pipeline after adding runtime image', () => {
    cy.createPipeline();

    cy.addFileToPipeline('helloworld.ipynb'); // add Notebook

    cy.get('#jp-main-dock-panel').within(() => {
      cy.findByText('helloworld.ipynb').rightclick();

      cy.findByRole('menuitem', { name: /properties/i }).click();

      // Adds runtime image to new node
      // TODO we should use the `for` attribute for the label
      cy.get('#downshift-0-toggle-button').click();

      cy.findByRole('option', { name: /anaconda/i }).click();
    });

    cy.savePipeline();

    // can take a moment to register as saved in ci
    cy.wait(1000);

    cy.findByRole('button', { name: /run pipeline/i }).click();

    cy.findByLabelText(/pipeline name/i).should('have.value', 'untitled');
    cy.findByLabelText(/runtime platform/i).should('have.value', 'local');
    cy.findByLabelText(/runtime configuration/i).should('have.value', 'local');

    // execute
    cy.findByRole('button', { name: /ok/i }).click();

    // validate job was executed successfully, this can take a while in ci
    cy.findByText(/job execution succeeded/i, { timeout: 30000 }).should(
      'be.visible'
    );
    // dismiss 'Job Succeeded' dialog
    cy.findByRole('button', { name: /ok/i }).click();
  });

  it('should run pipeline with env vars and output files', () => {
    cy.openFile('helloworld.pipeline');

    cy.findByRole('button', { name: /run pipeline/i }).click();

    cy.findByLabelText(/pipeline name/i).should('have.value', 'helloworld');
    cy.findByLabelText(/runtime configuration/i).should('have.value', 'local');

    // execute
    cy.findByRole('button', { name: /ok/i }).click();

    // validate job was executed successfully, this can take a while in ci
    cy.findByText(/job execution succeeded/i, { timeout: 30000 }).should(
      'be.visible'
    );
    // dismiss 'Job Succeeded' dialog
    cy.findByRole('button', { name: /ok/i }).click();

    cy.readFile('build/cypress-tests/output.txt').should(
      'be.equal',
      'TEST_ENV_1=1\nTEST_ENV_2=2\n'
    );
  });

  it('should fail to export invalid pipeline', () => {
    // Copy invalid pipeline

    cy.openFile('invalid.pipeline');

    cy.findByRole('button', { name: /export pipeline/i }).click();

    cy.findByText(/failed export:/i).should('be.visible');
  });

  it('should export pipeline', () => {
    // Create runtime configuration
    cy.createRuntimeConfig({ type: 'kfp' });

    // go back to file browser
    cy.findByRole('tab', { name: /file browser/i }).click();

    cy.openFile('helloworld.pipeline');

    // try to export valid pipeline
    cy.findByRole('button', { name: /export pipeline/i }).click();

    cy.findByLabelText(/runtime configuration/i)
      .select('test_runtime') // there might be other runtimes present when testing locally, so manually select.
      .should('have.value', 'test_runtime');

    // Validate all export options are available
    cy.findByLabelText(/export pipeline as/i)
      .select('KFP domain-specific language Python code')
      .should('have.value', 'py')
      .select('KFP static configuration file (YAML formatted)')
      .should('have.value', 'yaml');

    // actual export requires minio
    cy.findByRole('button', { name: /ok/i }).click();

    // validate job was executed successfully, this can take a while in ci
    cy.findByText(/pipeline export succeeded/i, { timeout: 30000 }).should(
      'be.visible'
    );

    cy.readFile('build/cypress-tests/helloworld.yaml');
  });

  it('should not leak properties when switching between nodes', () => {
    cy.openFile('helloworld.pipeline');

    cy.get('#jp-main-dock-panel').within(() => {
      cy.findByText('helloworld.ipynb').rightclick();

      cy.findByRole('menuitem', { name: /properties/i }).click();

      cy.findByText('TEST_ENV_1=1').should('exist');

      cy.findByText('helloworld.py').click();

      cy.get('[data-id="properties-env_vars"]').within(() => {
        cy.findByRole('button', { name: /add item/i }).click();

        cy.focused().type('BAD=two');

        cy.findByRole('button', { name: /ok/i }).click();
      });

      cy.findByText('BAD=two').should('exist');

      cy.findByText('helloworld.ipynb').click();

      cy.findByText('TEST_ENV_1=1').should('exist');
      cy.findByText('BAD=two').should('not.exist');

      cy.findByText('helloworld.py').click();

      cy.findByText('BAD=two').should('exist');
    });
  });

  it('kfp pipeline should display custom components', () => {
    cy.createPipeline({ type: 'kfp' });
    cy.openPalette();

    const kfpCustomComponents = ['papermill', 'filter text', 'kfserving'];

    kfpCustomComponents.forEach(component => {
      cy.findByText(new RegExp(component, 'i')).should('exist');
    });
  });

  it('kfp pipeline should display expected export options', () => {
    cy.createPipeline({ type: 'kfp' });
    cy.savePipeline();

    cy.createRuntimeConfig({ type: 'kfp' });

    // Validate all export options are available
    cy.findByRole('button', { name: /export pipeline/i }).click();
    cy.findByRole('option', { name: /yaml/i }).should('have.value', 'yaml');
    cy.findByRole('option', { name: /python/i }).should('not.exist');

    // Dismiss dialog
    cy.findByRole('button', { name: /cancel/i }).click();
  });

  it('airflow pipeline should display custom components', () => {
    cy.createPipeline({ type: 'airflow' });
    cy.openPalette();

    const airflowCustomComponents = [
      'bash',
      'email',
      'HTTP',
      'spark JDBC',
      'spark sql',
      'spark submit'
    ];

    airflowCustomComponents.forEach(component => {
      cy.findByText(new RegExp(component, 'i')).should('exist');
    });
  });

  it('airflow pipeline should display expected export options', () => {
    cy.createPipeline({ type: 'airflow' });
    cy.savePipeline();

    cy.createRuntimeConfig();

    // Validate all export options are available
    cy.findByRole('button', { name: /export pipeline/i }).click();
    cy.findByRole('option', { name: /python/i }).should('have.value', 'py');
    cy.findByRole('option', { name: /yaml/i }).should('not.exist');

    // Dismiss dialog
    cy.findByRole('button', { name: /cancel/i }).click();
  });
});

// ------------------------------
// ----- Utility Functions
// ------------------------------

const checkEnabledToolbarButtons = (buttons: RegExp[]): void => {
  for (const button of buttons) {
    cy.findByRole('button', { name: button }).should('not.be.disabled');
  }
};

const checkDisabledToolbarButtons = (buttons: RegExp[]): void => {
  for (const button of buttons) {
    cy.findByRole('button', { name: button }).should('be.disabled');
  }
};
