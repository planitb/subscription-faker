import {ListAddElementMorph, Morph} from "../src/Morphs";


describe("ListAddElementMorph", () => {

    it("should be creatable", () => {
        expect(new ListAddElementMorph(1, "foo", "$", 10, null)).toBeTruthy();
    });

    it("should be able to extend top level list elements", async (done) => {
        const m = new ListAddElementMorph(1, "foo", "$", 10, () => Promise.resolve([1, 2, 3]));
        const data = [];

        await Morph.cycle(data);
        expect(data).toEqual([1]);

        await Morph.cycle(data);
        expect(data.sort()).toEqual([1, 2]);

        await Morph.cycle(data);
        expect(data.sort()).toEqual([1, 2, 3]);

        await Morph.cycle(data);
        expect(data.sort()).toEqual([1, 1, 2, 3]);

        await Morph.cycle(data);
        expect(data.sort()).toEqual([1, 1, 2, 2, 3]);

        await Morph.cycle(data);
        expect(data.sort()).toEqual([1, 1, 2, 2, 3, 3]);

        done();
    });

    it("should be able to extend nested list elements", async (done) => {
        const m = new ListAddElementMorph(1, "foo", "$.data", 10, () => Promise.resolve({data: [1, 2, 3]}));
        const data = {data: []};

        await Morph.cycle(data);
        expect(data).toEqual({data: [1]});

        await Morph.cycle(data);
        expect(data.data.sort()).toEqual([1, 2]);

        await Morph.cycle(data);
        expect(data.data.sort()).toEqual([1, 2, 3]);

        await Morph.cycle(data);
        expect(data.data.sort()).toEqual([1, 1, 2, 3]);

        await Morph.cycle(data);
        expect(data.data.sort()).toEqual([1, 1, 2, 2, 3]);

        await Morph.cycle(data);
        expect(data.data.sort()).toEqual([1, 1, 2, 2, 3, 3]);

        done();
    });

    it("should be able to extend deeply nested lists", async (done) => {
        const m = new ListAddElementMorph(1, "foo", "$.data[*].foo", 10, () => Promise.resolve({data: [{foo: [1, 2, 3]}]}));
        const data = {data: [{foo: []}]};

        await Morph.cycle(data);
        expect(data.data[0]).toEqual({foo: [1]});

        await Morph.cycle(data);
        expect(data.data[0].foo.sort()).toEqual([1, 2]);

        await Morph.cycle(data);
        expect(data.data[0].foo.sort()).toEqual([1, 2, 3]);

        await Morph.cycle(data);
        expect(data.data[0].foo.sort()).toEqual([1, 1, 2, 3]);

        await Morph.cycle(data);
        expect(data.data[0].foo.sort()).toEqual([1, 1, 2, 2, 3]);

        await Morph.cycle(data);
        expect(data.data[0].foo.sort()).toEqual([1, 1, 2, 2, 3, 3]);

        done();

    });

    it("should be able to extend multiple deeply nested lists", () => {

    });
});
