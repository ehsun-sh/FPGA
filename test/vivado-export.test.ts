// The "Build it in Vivado" export: the double-click scripts in every project, the FPGA Lab helper (the Tcl server
// that runs Vivado for the website) and the build progress read from Vivado's log.
import { describe, expect, it } from 'vitest';
import { execSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { getBoard } from '../src/boards';
import { canProgram, projectDir, projectFiles, type ProjectSpec } from '../src/synth/project';
import { HELPER_PORT, helperTclFor, phaseOf, type Phase } from '../src/synth/helper';
import { buildBat, programTcl, startHelperBat } from '../src/synth/scripts';

const nexys: ProjectSpec = { name: 'fpga_lab_counter', lang: 'verilog', top: 'top', src: 'module top; endmodule', xdc: '', xdcName: 'n.xdc', part: 'xc7a100tcsg324-1', board: 'Nexys A7-100T' };

describe('double-click scripts in an exported project', () => {
  it('adds build and program scripts to a Nexys project', () => {
    const fs = projectFiles(nexys);
    const get = (n: string) => fs.find((f) => f.name === `fpga_lab_counter/${n}`)?.data;
    const bat = get('build.bat')!;
    expect(bat).toContain('-source create_project.tcl -tclargs build');
    expect(bat).toContain(':find_vivado');
    // cmd.exe needs CRLF for labels and call :sub
    expect(bat.split('\n').every((l, i, a) => i === a.length - 1 || l.endsWith('\r'))).toBe(true);
    expect(get('build.sh')).toContain('-source create_project.tcl -tclargs build');
    expect(get('build.sh')).not.toContain('\r');
    expect(get('program_board.tcl')).toContain('get_hw_devices -quiet xc7a100t*');
    expect(get('program.bat')).toContain('-source program_board.tcl');
    expect(get('README.txt')).toContain('double-click build.bat');
    // a failed run makes the batch build fail instead of printing a bitstream path
    expect(get('create_project.tcl')).toContain('if {[get_property PROGRESS [get_runs synth_1]] ne "100%"}');
  });

  it('gives the EBAZ4205 projects a build script but no program script', () => {
    const ebaz = getBoard('ebaz4205');
    const spec: ProjectSpec = { ...nexys, name: 'fpga_lab_z-blink', part: ebaz.part, internalClock: ebaz.internalClock };
    const names = projectFiles(spec).map((f) => f.name);
    expect(names).toContain('fpga_lab_z-blink/build.bat');
    expect(names).not.toContain('fpga_lab_z-blink/program.bat');
    expect(canProgram(spec)).toBe(false);
    const ps = projectFiles({ ...spec, ps: { mode: 'ethernet' } }).map((f) => f.name);
    expect(ps).toContain('fpga_lab_z-blink/build.sh');
    expect(ps).not.toContain('fpga_lab_z-blink/program_board.tcl');
  });

  it('names project folders the way the helper accepts them', () => {
    expect(projectDir({ name: 'fpga_lab_z-ps-hello' })).toBe('fpga_lab_z-ps-hello');
    expect(projectDir({ name: 'a b/../c' })).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(buildBat('x')).toContain('find "("');
    expect(startHelperBat()).toContain('-source fpgalab-helper.tcl');
    expect(programTcl('xc7z010clg400-1')).toContain('xc7z010*');
  });
});

describe('the FPGA Lab helper', () => {
  it('bakes in the allowed origins and the port', () => {
    const tcl = helperTclFor(['http://example.test:8080', 'javascript:alert(1)']);
    expect(tcl).not.toMatch(/@(ORIGINS|PORT)@/);
    expect(tcl).toContain('set ::ALLOWED {https://learn.shahmohammadi.dev http://example.test:8080}');
    expect(tcl).toContain(`set ::PORT ${HELPER_PORT}`);
    expect(tcl).not.toContain('javascript:');
  });

  it('follows the build phases forward only', () => {
    const lines = ['# create_project x', '[Fri] Launched synth_1...', 'INFO: something', '[Fri] Launched impl_1...', 'WARNING: [Synth 8-1] synth_1', 'Bitstream: /x/top.bit'];
    const seen: Phase[] = [];
    let p: Phase = 'project';
    for (const l of lines) seen.push((p = phaseOf(l, p)));
    expect(seen).toEqual(['project', 'synth', 'synth', 'impl', 'impl', 'done']);
  });

  let tclsh = false;
  try {
    execSync('command -v tclsh', { stdio: 'ignore' });
    tclsh = true;
  } catch {
    /* no Tcl on this machine: the server test is skipped */
  }

  // the real Tcl server with a stand-in for Vivado (runs where tclsh is installed)
  it.skipIf(!tclsh)('writes a project, runs Vivado on it and refuses other websites', async () => {
    const dir = mkdtempSync(`${tmpdir()}/fpgalab-`);
    const port = String(48000 + Math.floor(Math.random() * 1000));
    writeFileSync(`${dir}/fpgalab-helper.tcl`, helperTclFor([]));
    writeFileSync(`${dir}/vivado`, '#!/bin/sh\necho "args $*"\necho "[x] Launched synth_1..."\necho "Bitstream: $(pwd)/top.bit"\n', { mode: 0o755 });
    const child = spawn('tclsh', [`${dir}/fpgalab-helper.tcl`], { env: { ...process.env, FPGALAB_VIVADO: `${dir}/vivado`, FPGALAB_ROOT: `${dir}/projects`, FPGALAB_PORT: port } });
    const url = `http://127.0.0.1:${port}`;
    const site = { origin: 'https://learn.shahmohammadi.dev' };
    try {
      await new Promise<void>((res) => child.stdout.on('data', (b) => new TextDecoder().decode(b).includes('is running') && res()));
      const st = await (await fetch(`${url}/status`, { headers: site })).json();
      expect(st.ok).toBe(true);
      expect((await fetch(`${url}/status`, { headers: { origin: 'https://evil.example' } })).status).toBe(403);
      expect((await fetch(`${url}/status`)).status).toBe(403);
      const put = (path: string, body: string) => fetch(`${url}/file?dir=p1&path=${encodeURIComponent(path)}`, { method: 'POST', headers: site, body });
      expect((await put('create_project.tcl', 'puts hi سلام')).status).toBe(200);
      expect((await put('../escape.txt', 'x')).status).toBe(400);
      expect(readFileSync(`${dir}/projects/p1/create_project.tcl`, 'utf8')).toBe('puts hi سلام');
      const { job } = await (await fetch(`${url}/build?dir=p1&what=build`, { method: 'POST', headers: site })).json();
      let log = { lines: [] as string[], done: false, code: null as number | null };
      for (let i = 0; i < 50 && !log.done; i++) {
        await new Promise((r) => setTimeout(r, 100));
        log = await (await fetch(`${url}/log?job=${job}&from=0`, { headers: site })).json();
      }
      expect(log.done).toBe(true);
      expect(log.code).toBe(0);
      expect(log.lines.join('\n')).toContain('args -mode batch -nojournal -log build.log -source create_project.tcl -tclargs build');
      expect(log.lines.at(-1)).toMatch(/^Bitstream: .*projects\/p1\/top\.bit$/);
    } finally {
      child.kill();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
