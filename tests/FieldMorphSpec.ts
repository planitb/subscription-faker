import {MorphScalar, Morph} from "../src/Morphs";


describe("FieldMorphSpec", () => {

    it("can be created", () => {
        expect(new MorphScalar(0.5, "test", "$.foo.bar", (o) => Promise.resolve()));
    });

    it("can update top level fields", () => {
        const m = new MorphScalar(1, "test", "$", (o) => {
            o["data"]++;
            return Promise.resolve();
        });
        const o = {
            data: 10
        };

        Morph.cycle(o);
        expect(o).toEqual({data: 11});
    });

    it("can update nested fields", () => {
        const m = new MorphScalar(1, "test", "$.nested", (o) => {
            o["data"]++;
            return Promise.resolve();
        });
        const o = {
            nested: {data: 10}
        };

        Morph.cycle(o);
        expect(o).toEqual({nested: {data: 11}});
    });

    it("can update fields embedded in arrays", () => {
        const m = new MorphScalar(1, "test", "$.nested[*]", (o) => {
            o["data"]++;
            return Promise.resolve();
        });
        const o = {
            nested: [{data: 10}]
        };

        Morph.cycle(o);
        expect(o).toEqual({nested: [{data: 11}]});
    });

    it("is benign if applied to non-matching data", () => {
        const m = new MorphScalar(1, "test", "$.nested[*]", (o) => {
            o["data"]++;
            return Promise.resolve();
        });
        const o = {
            foo: [{bar: 10}]
        };

        Morph.cycle(o);
        expect(o).toEqual({foo: [{bar: 10}]});
    });

    it("its threshold reflects how often it is applied ... maybe never", () => {
        const m = new MorphScalar(0, "test", "$", (o) => {
            o["data"]++;
            return Promise.resolve();
        });
        const o = {
            data: 10
        };

        for(let n = 0; n < 100; n++) {
            Morph.cycle(o);
        }

        expect(o).toEqual({data: 10});
    });

    it("its threshold reflects how often it is applied", async (done) => {
        const m = new MorphScalar(0.5, "test", "$", (o) => {
            o["data"]++;
            return Promise.resolve();
        });
        const o = {
            data: 0
        };

        let r = false;
        spyOn(Math, "random").and.callFake(() => {
            r = !r;
            return r ? 1 : 0;
        });

        for(let n = 0; n < 100; n++) {
            await Morph.cycle(o);
        }

        expect(o).toEqual({data: 50});
        done();
    });

    it("can update multiple fields", () => {
        const m = new MorphScalar(1, "test", "$.nested[*]", (o) => {
            o["bar"]++;
            return Promise.resolve();
        });
        const o = {
            nested: [{bar: 10}, {bar: 20}]
        };

        Morph.cycle(o);
        expect(o).toEqual({nested: [{bar: 11}, {bar: 21}]});
    });
});
