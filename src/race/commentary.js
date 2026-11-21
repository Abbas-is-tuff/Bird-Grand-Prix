// Race commentary: text lines in the ticker + spoken announcements for big moments.
import { formatTime, ordinal, pick } from '../core/utils.js';

export class Commentary {
  constructor(race, audio, hud) {
    this.race = race;
    this.audio = audio;
    this.hud = hud;
    this.lastLeaderCall = -10;
    this.lastBumpCall = -10;
    const def = race.def;
    const on = (ev, fn) => race.on(ev, fn);

    if (race.drill) {
      // training: a coach instead of a stadium announcer
      on('phase', (p) => {
        if (p === 'marks') this.line(`Training: ${def.name}. ${race.drill.hint}`);
      });
      on('gun', () => { this.audio.gun(); this.line('Go go go!'); });
      on('falseStart', ({ racer }) => { this.audio.doubleGun(); this.line(`Too early, ${racer.name}! Wait for the gun.`); });
      on('barrierClear', () => { if (Math.random() < 0.5) this.line(pick(['Nice jump!', 'Clean!', 'Good timing!', 'Up and over!'])); });
      on('barrierHit', () => this.line(pick(['Clipped it! Jump a bit earlier.', 'Ouch — that barrier went down!', 'Too late on that one!'])));
      on('barrierMiss', () => this.line('You ran around the barrier — that does not count!'));
      on('finish', (r) => { this.audio.chirp(r.species.size, 0.25); this.line(`Drill complete in ${formatTime(r.finishTime)} s.`); });
      return;
    }
    on('barrierHit', ({ racer }) => { if (racer.isPlayer || Math.random() < 0.3) this.line(`${racer.name} hits a barrier!`); });
    on('phase', (p) => {
      if (p === 'intro') {
        const names = race.byLane.map((r) => `Lane ${r.lane}: ${r.name}`).join('   ');
        this.line(`Welcome to Featherfield Stadium for the ${def.name}!`);
        this.audio.say(`Welcome to the Bird Grand Prix. The ${def.dist} metres.`, { priority: true });
        setTimeout(() => this.race.phase === 'intro' && this.line(names), 2200);
      } else if (p === 'marks') {
        this.line('On your marks...');
        this.audio.say('On your marks.', { priority: true });
      } else if (p === 'set') {
        this.line('Set...');
        this.audio.say('Set.', { priority: true });
      }
    });
    on('gun', () => {
      this.audio.gun();
      this.line("And they're away!");
      setTimeout(() => this.audio.say("And they're away!"), 450);
    });
    on('falseStart', ({ racer, dq }) => {
      this.audio.doubleGun();
      const t = dq ? `${racer.name} false starts again and is disqualified!` : `False start! ${racer.name} is warned. One more and it's a disqualification.`;
      this.line(t);
      this.audio.say(dq ? `${racer.name} is disqualified.` : `False start. ${racer.name} is warned.`, { priority: true });
    });
    on('leader', (r) => {
      const t = race.raceTime;
      if (t - this.lastLeaderCall < 3.5) return;
      this.lastLeaderCall = t;
      const s = pick([`${r.name} takes the lead!`, `${r.name} hits the front!`, `It's ${r.name} in front now!`, `${r.name} moves ahead!`]);
      this.line(s);
      this.audio.say(s);
    });
    on('halfway', (r) => this.speakLine(`Halfway, and ${r.name} leads!`));
    on('finalStraight', (r) => this.speakLine(`Into the home straight! ${r.name} leads the way!`));
    on('bell', (r) => {
      this.audio.bell();
      this.speakLine(`The bell! One lap to go, and ${r.name} leads.`);
    });
    on('bump', ({ a, b, strength }) => {
      this.audio.bump(0.15 + strength * 0.3);
      const t = race.raceTime;
      if (t - this.lastBumpCall < 5) return;
      if (!(a.isPlayer || b.isPlayer) && Math.random() > 0.35) return;
      this.lastBumpCall = t;
      this.line(`Contact between ${a.name} and ${b.name}!`);
    });
    on('dq', (r) => this.speakLine(`${r.name} has stepped inside the lane and is disqualified!`, true));
    on('break', () => this.hud.hint('Break line! You can move to the inside lane now (steer left).', 4));
    on('finish', (r) => {
      const order = race.finishOrder;
      if (order.length === 1) {
        this.audio.fanfare();
        this.audio.chirp(r.species.size, 0.25);
        this.speakLine(`${r.name} wins it in ${formatTime(r.finishTime)} seconds!`, true);
      } else if (order.length === 2 && r.finishTime - order[0].finishTime < 0.06) {
        this.speakLine(`What a photo finish! ${order[0].name} just holds off ${r.name}!`, true);
      }
      if (r.isPlayer && order.length > 1) this.line(`${r.name} finishes ${ordinal(order.length)} in ${formatTime(r.finishTime)}.`);
    });
  }

  line(text) {
    this.hud.ticker(text);
  }

  speakLine(text, priority = false) {
    this.line(text);
    this.audio.say(text, { priority });
  }
}
