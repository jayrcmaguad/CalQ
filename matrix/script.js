/* =========================================================
   MATRIX CALCULATOR
   ========================================================= */

(() => {
  "use strict";


  /* =======================================================
     STATE
     ======================================================= */

  const state = {
    matrices: {},
    history: [],
    nextMatrixIndex: 0
  };


  /* =======================================================
     DOM
     ======================================================= */

  const $ = selector =>
    document.querySelector(selector);

  const expressionInput =
    $("#expressionInput");

  const calculateButton =
    $("#calculateButton");

  const errorMessage =
    $("#errorMessage");

  const matricesContainer =
    $("#matricesContainer");

  const emptyMatrices =
    $("#emptyMatrices");

  const resultContainer =
    $("#resultContainer");

  const historyContainer =
    $("#historyContainer");

  const clearHistoryButton =
    $("#clearHistoryButton");

  const menuButton =
    $("#menuButton");

  const sideMenu =
    $("#sideMenu");

  const menuBackdrop =
    $("#menuBackdrop");

  const settingsToggle =
    $("#settingsToggle");

  const settingsContent =
    $("#settingsContent");

  const commandsToggle =
    $("#commandsToggle");

  const commandsContent =
    $("#commandsContent");

  const addMatrixButton =
    $("#addMatrixButton");


  /* =======================================================
     BASIC HELPERS
     ======================================================= */

  function cloneMatrix(matrix) {
    return matrix.map(row => [...row]);
  }


  function isMatrix(value) {
    return (
      value &&
      value.type === "matrix" &&
      Array.isArray(value.value)
    );
  }


  function matrixValue(value) {
    return isMatrix(value)
      ? value.value
      : value;
  }


  function makeMatrix(value) {
    return {
      type: "matrix",
      value
    };
  }


  function makeScalar(value) {
    return {
      type: "scalar",
      value
    };
  }


  function makeIdentity() {
    return {
      type: "identity"
    };
  }


  function isSquare(matrix) {
    return (
      Array.isArray(matrix) &&
      matrix.length > 0 &&
      matrix.every(
        row => row.length === matrix.length
      )
    );
  }


  function rows(matrix) {
    return matrix.length;
  }


  function cols(matrix) {
    return matrix.length
      ? matrix[0].length
      : 0;
  }


  function nearlyZero(value) {
    return Math.abs(value) < 1e-10;
  }


  function cleanNumber(value) {

    if (Math.abs(value) < 1e-12) {
      return 0;
    }

    const rounded =
      Math.round(value);

    if (
      Math.abs(value - rounded) <
      1e-10
    ) {
      return rounded;
    }

    return Number(
      value.toFixed(10)
    );
  }


  function formatNumber(value) {

    value =
      cleanNumber(Number(value));

    if (!Number.isFinite(value)) {
      return String(value);
    }

    return String(value);
  }


  function escapeHTML(value) {

    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  /* =======================================================
     MATRIX OPERATIONS
     ======================================================= */

  const Matrix = {

    add(a, b) {

      if (
        rows(a) !== rows(b) ||
        cols(a) !== cols(b)
      ) {
        throw new Error(
          "Matrix dimensions must match for addition."
        );
      }

      return a.map((row, i) =>
        row.map((value, j) =>
          cleanNumber(
            value + b[i][j]
          )
        )
      );
    },


    subtract(a, b) {

      if (
        rows(a) !== rows(b) ||
        cols(a) !== cols(b)
      ) {
        throw new Error(
          "Matrix dimensions must match for subtraction."
        );
      }

      return a.map((row, i) =>
        row.map((value, j) =>
          cleanNumber(
            value - b[i][j]
          )
        )
      );
    },


    multiply(a, b) {

      if (cols(a) !== rows(b)) {
        throw new Error(
          `Cannot multiply ${rows(a)}×${cols(a)} by ${rows(b)}×${cols(b)}.`
        );
      }

      const result =
        Array.from(
          { length: rows(a) },
          () =>
            Array(
              cols(b)
            ).fill(0)
        );

      for (
        let i = 0;
        i < rows(a);
        i++
      ) {

        for (
          let j = 0;
          j < cols(b);
          j++
        ) {

          let sum = 0;

          for (
            let k = 0;
            k < cols(a);
            k++
          ) {

            sum +=
              a[i][k] *
              b[k][j];
          }

          result[i][j] =
            cleanNumber(sum);
        }
      }

      return result;
    },


    scalarMultiply(scalar, matrix) {

      return matrix.map(row =>
        row.map(value =>
          cleanNumber(
            scalar * value
          )
        )
      );
    },


    transpose(matrix) {

      if (!matrix.length) {
        return [];
      }

      return Array.from(
        { length: cols(matrix) },
        (_, j) =>
          Array.from(
            { length: rows(matrix) },
            (_, i) =>
              matrix[i][j]
          )
      );
    },


    identity(size) {

      return Array.from(
        { length: size },
        (_, i) =>
          Array.from(
            { length: size },
            (_, j) =>
              i === j
                ? 1
                : 0
          )
      );
    },


    determinant(matrix) {

      if (!isSquare(matrix)) {
        throw new Error(
          "Determinant requires a square matrix."
        );
      }

      const n =
        matrix.length;

      if (n === 1) {
        return matrix[0][0];
      }

      if (n === 2) {

        return cleanNumber(
          matrix[0][0] *
          matrix[1][1] -
          matrix[0][1] *
          matrix[1][0]
        );
      }

      const a =
        cloneMatrix(matrix);

      let det = 1;
      let sign = 1;

      for (
        let i = 0;
        i < n;
        i++
      ) {

        let pivot = i;

        for (
          let r = i + 1;
          r < n;
          r++
        ) {

          if (
            Math.abs(a[r][i]) >
            Math.abs(a[pivot][i])
          ) {
            pivot = r;
          }
        }

        if (
          nearlyZero(
            a[pivot][i]
          )
        ) {
          return 0;
        }

        if (pivot !== i) {

          [
            a[pivot],
            a[i]
          ] = [
            a[i],
            a[pivot]
          ];

          sign *= -1;
        }

        const pivotValue =
          a[i][i];

        det *= pivotValue;

        for (
          let r = i + 1;
          r < n;
          r++
        ) {

          const factor =
            a[r][i] /
            pivotValue;

          for (
            let c = i;
            c < n;
            c++
          ) {

            a[r][c] -=
              factor *
              a[i][c];
          }
        }
      }

      return cleanNumber(
        det * sign
      );
    },


    inverse(matrix) {

      if (!isSquare(matrix)) {
        throw new Error(
          "Inverse requires a square matrix."
        );
      }

      const n =
        matrix.length;

      const augmented =
        matrix.map((row, i) => [
          ...row,
          ...this.identity(n)[i]
        ]);

      for (
        let col = 0;
        col < n;
        col++
      ) {

        let pivot = col;

        for (
          let row = col + 1;
          row < n;
          row++
        ) {

          if (
            Math.abs(
              augmented[row][col]
            ) >
            Math.abs(
              augmented[pivot][col]
            )
          ) {
            pivot = row;
          }
        }

        if (
          nearlyZero(
            augmented[pivot][col]
          )
        ) {
          throw new Error(
            "Matrix is singular and has no inverse."
          );
        }

        [
          augmented[col],
          augmented[pivot]
        ] = [
          augmented[pivot],
          augmented[col]
        ];

        const pivotValue =
          augmented[col][col];

        for (
          let j = 0;
          j < 2 * n;
          j++
        ) {
          augmented[col][j] /=
            pivotValue;
        }

        for (
          let row = 0;
          row < n;
          row++
        ) {

          if (row === col) {
            continue;
          }

          const factor =
            augmented[row][col];

          for (
            let j = 0;
            j < 2 * n;
            j++
          ) {

            augmented[row][j] -=
              factor *
              augmented[col][j];
          }
        }
      }

      return augmented.map(row =>
        row
          .slice(n)
          .map(cleanNumber)
      );
    },


    ref(matrix) {

      const a =
        cloneMatrix(matrix);

      let pivotRow = 0;

      for (
        let pivotCol = 0;
        pivotCol < cols(a) &&
        pivotRow < rows(a);
        pivotCol++
      ) {

        let pivot = pivotRow;

        for (
          let row = pivotRow + 1;
          row < rows(a);
          row++
        ) {

          if (
            Math.abs(
              a[row][pivotCol]
            ) >
            Math.abs(
              a[pivot][pivotCol]
            )
          ) {
            pivot = row;
          }
        }

        if (
          nearlyZero(
            a[pivot][pivotCol]
          )
        ) {
          continue;
        }

        [
          a[pivotRow],
          a[pivot]
        ] = [
          a[pivot],
          a[pivotRow]
        ];

        for (
          let row = pivotRow + 1;
          row < rows(a);
          row++
        ) {

          const factor =
            a[row][pivotCol] /
            a[pivotRow][pivotCol];

          for (
            let col = pivotCol;
            col < cols(a);
            col++
          ) {

            a[row][col] -=
              factor *
              a[pivotRow][col];
          }
        }

        pivotRow++;
      }

      return a.map(row =>
        row.map(cleanNumber)
      );
    },


    rref(matrix) {

      const a =
        cloneMatrix(matrix);

      let pivotRow = 0;

      for (
        let pivotCol = 0;
        pivotCol < cols(a) &&
        pivotRow < rows(a);
        pivotCol++
      ) {

        let pivot = pivotRow;

        for (
          let row = pivotRow + 1;
          row < rows(a);
          row++
        ) {

          if (
            Math.abs(
              a[row][pivotCol]
            ) >
            Math.abs(
              a[pivot][pivotCol]
            )
          ) {
            pivot = row;
          }
        }

        if (
          nearlyZero(
            a[pivot][pivotCol]
          )
        ) {
          continue;
        }

        [
          a[pivotRow],
          a[pivot]
        ] = [
          a[pivot],
          a[pivotRow]
        ];

        const pivotValue =
          a[pivotRow][pivotCol];

        for (
          let col = 0;
          col < cols(a);
          col++
        ) {

          a[pivotRow][col] /=
            pivotValue;
        }

        for (
          let row = 0;
          row < rows(a);
          row++
        ) {

          if (row === pivotRow) {
            continue;
          }

          const factor =
            a[row][pivotCol];

          for (
            let col = 0;
            col < cols(a);
            col++
          ) {

            a[row][col] -=
              factor *
              a[pivotRow][col];
          }
        }

        pivotRow++;
      }

      return a.map(row =>
        row.map(cleanNumber)
      );
    },


    rank(matrix) {

      const rref =
        this.rref(matrix);

      return rref.filter(row =>
        row.some(
          value =>
            !nearlyZero(value)
        )
      ).length;
    },


    trace(matrix) {

      if (!isSquare(matrix)) {
        throw new Error(
          "Trace requires a square matrix."
        );
      }

      let result = 0;

      for (
        let i = 0;
        i < matrix.length;
        i++
      ) {

        result +=
          matrix[i][i];
      }

      return cleanNumber(result);
    },


    minor(matrix, row, col) {

      return matrix
        .filter(
          (_, i) => i !== row
        )
        .map(r =>
          r.filter(
            (_, j) => j !== col
          )
        );
    },


    cofactor(matrix) {

      if (!isSquare(matrix)) {
        throw new Error(
          "Cofactor requires a square matrix."
        );
      }

      const n =
        matrix.length;

      if (n === 1) {
        return [[1]];
      }

      return matrix.map(
        (_, i) =>
          matrix[i].map(
            (_, j) => {

              const minor =
                this.minor(
                  matrix,
                  i,
                  j
                );

              const value =
                this.determinant(
                  minor
                );

              return cleanNumber(
                ((i + j) % 2 === 0)
                  ? value
                  : -value
              );
            }
          )
      );
    },


    adjugate(matrix) {

      return this.transpose(
        this.cofactor(matrix)
      );
    },


    power(matrix, exponent) {

      if (!isSquare(matrix)) {
        throw new Error(
          "Matrix power requires a square matrix."
        );
      }

      if (
        !Number.isInteger(exponent) ||
        exponent < 0
      ) {
        throw new Error(
          "Matrix power requires a non-negative integer exponent."
        );
      }

      let result =
        this.identity(
          matrix.length
        );

      let base =
        cloneMatrix(matrix);

      let n = exponent;

      while (n > 0) {

        if (n % 2 === 1) {

          result =
            this.multiply(
              result,
              base
            );
        }

        base =
          this.multiply(
            base,
            base
          );

        n =
          Math.floor(
            n / 2
          );
      }

      return result;
    },


    isSymmetric(matrix) {

      if (!isSquare(matrix)) {
        return false;
      }

      const t =
        this.transpose(matrix);

      for (
        let i = 0;
        i < rows(matrix);
        i++
      ) {

        for (
          let j = 0;
          j < cols(matrix);
          j++
        ) {

          if (
            !nearlyZero(
              matrix[i][j] -
              t[i][j]
            )
          ) {
            return false;
          }
        }
      }

      return true;
    },


    isOrthogonal(matrix) {

      if (!isSquare(matrix)) {
        return false;
      }

      const t =
        this.transpose(matrix);

      const product =
        this.multiply(
          t,
          matrix
        );

      const identity =
        this.identity(
          matrix.length
        );

      for (
        let i = 0;
        i < rows(product);
        i++
      ) {

        for (
          let j = 0;
          j < cols(product);
          j++
        ) {

          if (
            !nearlyZero(
              product[i][j] -
              identity[i][j]
            )
          ) {
            return false;
          }
        }
      }

      return true;
    },


    eigenvalues(matrix) {

      if (!isSquare(matrix)) {
        throw new Error(
          "Eigenvalues require a square matrix."
        );
      }

      const n =
        matrix.length;

      if (n === 1) {
        return [
          matrix[0][0]
        ];
      }

      if (n === 2) {

        const a =
          matrix[0][0];

        const b =
          matrix[0][1];

        const c =
          matrix[1][0];

        const d =
          matrix[1][1];

        const trace =
          a + d;

        const determinant =
          a * d - b * c;

        const discriminant =
          trace * trace -
          4 * determinant;

        if (discriminant >= 0) {

          const root =
            Math.sqrt(
              discriminant
            );

          return [
            cleanNumber(
              (trace + root) / 2
            ),
            cleanNumber(
              (trace - root) / 2
            )
          ];
        }

        const real =
          trace / 2;

        const imaginary =
          Math.sqrt(
            -discriminant
          ) / 2;

        return [
          {
            real:
              cleanNumber(real),

            imaginary:
              cleanNumber(imaginary)
          },

          {
            real:
              cleanNumber(real),

            imaginary:
              cleanNumber(-imaginary)
          }
        ];
      }

      throw new Error(
        "Numerical eigenvalues are currently implemented for matrices up to 2×2."
      );
    },


    eigenvectors(matrix) {

      if (!isSquare(matrix)) {
        throw new Error(
          "Eigenvectors require a square matrix."
        );
      }

      if (matrix.length !== 2) {
        throw new Error(
          "Numerical eigenvectors are currently implemented for 2×2 matrices."
        );
      }

      const eigenvalues =
        this.eigenvalues(matrix);

      return eigenvalues.map(
        lambda => {

          if (
            typeof lambda === "object" &&
            lambda.imaginary !== 0
          ) {

            return {
              eigenvalue: lambda,
              vector: null
            };
          }

          const l = lambda;

          const a =
            matrix[0][0] - l;

          const b =
            matrix[0][1];

          const c =
            matrix[1][0];

          const d =
            matrix[1][1] - l;

          let vector;

          if (
            !nearlyZero(a) ||
            !nearlyZero(b)
          ) {

            vector = [
              b,
              -a
            ];

          } else {

            vector = [
              -d,
              c
            ];
          }

          if (
            nearlyZero(vector[0]) &&
            nearlyZero(vector[1])
          ) {

            vector = [
              1,
              0
            ];
          }

          return {
            eigenvalue: l,
            vector:
              vector.map(cleanNumber)
          };
        }
      );
    }
  };


  /* =======================================================
     VALUE RESOLUTION
     ======================================================= */

  function firstSquareMatrix() {

    const values =
      Object.values(
        state.matrices
      );

    for (const matrix of values) {

      if (isSquare(matrix)) {
        return matrix;
      }
    }

    return null;
  }


  function resolveIdentity(
    contextMatrix = null
  ) {

    const reference =
      contextMatrix ||
      firstSquareMatrix();

    if (
      !reference ||
      !isSquare(reference)
    ) {

      throw new Error(
        "Identity matrix requires a square matrix dimension."
      );
    }

    return Matrix.identity(
      reference.length
    );
  }


  /* =======================================================
     TOKENIZER
     ======================================================= */

  const FUNCTION_NAMES =
    new Set([
      "det",
      "inv",
      "ref",
      "rref",
      "rank",
      "trace",
      "cofactor",
      "adj",
      "adjugate",
      "eigenvalues",
      "eigenvectors",
      "transpose",
      "trans"
    ]);


  function tokenize(input) {

    const tokens = [];

    let i = 0;

    while (i < input.length) {

      const char =
        input[i];

      if (/\s/.test(char)) {

        i++;
        continue;
      }

      if (
        /[0-9.]/.test(char)
      ) {

        const rest =
          input.slice(i);

        const match =
          rest.match(
            /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/
          );

        if (!match) {

          throw new Error(
            `Invalid number near "${rest.slice(0, 8)}".`
          );
        }

        tokens.push({
          type: "number",
          value:
            Number(match[0])
        });

        i +=
          match[0].length;

        continue;
      }

      if (
        /[A-Za-z]/.test(char)
      ) {

        let j = i;

        while (
          j < input.length &&
          /[A-Za-z]/.test(
            input[j]
          )
        ) {
          j++;
        }

        const word =
          input.slice(i, j);

        const lower =
          word.toLowerCase();

        if (
          FUNCTION_NAMES.has(lower) &&
          input[j] === "("
        ) {

          tokens.push({
            type: "function",
            value: lower
          });

          i = j;

          continue;
        }

        for (const letter of word) {

          tokens.push({
            type: "letter",
            value:
              letter.toUpperCase()
          });
        }

        i = j;

        continue;
      }

      const operators =
        "+-*/^(),";

      if (
        operators.includes(char)
      ) {

        tokens.push({
          type: "operator",
          value: char
        });

        i++;

        continue;
      }

      throw new Error(
        `Unexpected character "${char}".`
      );
    }

    tokens.push({
      type: "eof",
      value: null
    });

    return tokens;
  }


  /* =======================================================
     PARSER
     ======================================================= */

  class Parser {

    constructor(tokens) {
      this.tokens = tokens;
      this.position = 0;
    }

    peek() {
      return this.tokens[
        this.position
      ];
    }

    consume() {
      return this.tokens[
        this.position++
      ];
    }

    match(value) {

      if (
        this.peek().value === value
      ) {

        this.consume();

        return true;
      }

      return false;
    }

    expect(value) {

      if (!this.match(value)) {

        throw new Error(
          `Expected "${value}".`
        );
      }
    }

    parse() {

      const node =
        this.parseAddSubtract();

      if (
        this.peek().type !== "eof"
      ) {

        throw new Error(
          `Unexpected "${this.peek().value}".`
        );
      }

      return node;
    }

    parseAddSubtract() {

      let node =
        this.parseMultiply();

      while (
        this.peek().value === "+" ||
        this.peek().value === "-"
      ) {

        const operator =
          this.consume().value;

        const right =
          this.parseMultiply();

        node = {
          type: "binary",
          operator,
          left: node,
          right
        };
      }

      return node;
    }

    startsPrimary(token) {

      if (!token) {
        return false;
      }

      return (
        token.type === "number" ||
        token.type === "letter" ||
        token.type === "function" ||
        token.value === "("
      );
    }

    parseMultiply() {

      let node =
        this.parseUnary();

      while (true) {

        if (
          this.peek().value === "*"
        ) {

          this.consume();

          const right =
            this.parseUnary();

          node = {
            type: "binary",
            operator: "*",
            left: node,
            right
          };

          continue;
        }

        if (
          this.startsPrimary(
            this.peek()
          )
        ) {

          const right =
            this.parseUnary();

          node = {
            type: "binary",
            operator: "*",
            left: node,
            right
          };

          continue;
        }

        break;
      }

      return node;
    }

    parseUnary() {

      if (this.match("+")) {
        return this.parseUnary();
      }

      if (this.match("-")) {

        return {
          type: "unary",
          operator: "-",
          value:
            this.parseUnary()
        };
      }

      return this.parsePower();
    }

    parsePower() {

      let node =
        this.parsePrimary();

      if (this.match("^")) {

        if (
          this.peek().type === "letter" &&
          this.peek().value === "T"
        ) {

          this.consume();

          node = {
            type: "transpose",
            value: node
          };

        } else {

          const exponent =
            this.parseUnary();

          node = {
            type: "power",
            base: node,
            exponent
          };
        }
      }

      return node;
    }

    parsePrimary() {

      const token =
        this.peek();

      if (
        token.type === "number"
      ) {

        this.consume();

        return {
          type: "number",
          value: token.value
        };
      }

      if (
        token.type === "letter"
      ) {

        this.consume();

        return {
          type: "variable",
          name: token.value
        };
      }

      if (
        token.type === "function"
      ) {

        this.consume();

        const name =
          token.value;

        this.expect("(");

        const argument =
          this.parseAddSubtract();

        this.expect(")");

        return {
          type: "function",
          name,
          argument
        };
      }

      if (this.match("(")) {

        const node =
          this.parseAddSubtract();

        this.expect(")");

        return node;
      }

      throw new Error(
        "Incomplete expression."
      );
    }
  }


  /* =======================================================
     EXPRESSION EVALUATION
     ======================================================= */

  function evaluate(ast) {

    switch (ast.type) {

      case "number":

        return makeScalar(
          ast.value
        );

      case "variable":

        if (ast.name === "I") {
          return makeIdentity();
        }

        if (
          !Object.prototype.hasOwnProperty.call(
            state.matrices,
            ast.name
          )
        ) {

          throw new Error(
            `Matrix ${ast.name} does not exist.`
          );
        }

        return makeMatrix(
          cloneMatrix(
            state.matrices[
              ast.name
            ]
          )
        );

      case "unary": {

        const value =
          evaluate(ast.value);

        if (
          value.type === "scalar"
        ) {

          return makeScalar(
            -value.value
          );
        }

        if (
          value.type === "matrix"
        ) {

          return makeMatrix(
            Matrix.scalarMultiply(
              -1,
              value.value
            )
          );
        }

        if (
          value.type === "identity"
        ) {

          return makeMatrix(
            Matrix.scalarMultiply(
              -1,
              resolveIdentity()
            )
          );
        }

        throw new Error(
          "Invalid unary operation."
        );
      }

      case "transpose": {

        const value =
          evaluate(ast.value);

        if (
          value.type === "identity"
        ) {

          return makeMatrix(
            Matrix.transpose(
              resolveIdentity()
            )
          );
        }

        if (
          value.type !== "matrix"
        ) {

          throw new Error(
            "Transpose requires a matrix."
          );
        }

        return makeMatrix(
          Matrix.transpose(
            value.value
          )
        );
      }

      case "power": {

        const base =
          evaluate(ast.base);

        const exponent =
          evaluate(ast.exponent);

        if (
          base.type === "identity"
        ) {

          if (
            exponent.type !== "scalar"
          ) {

            throw new Error(
              "Matrix exponent must be a scalar."
            );
          }

          return makeMatrix(
            Matrix.power(
              resolveIdentity(),
              exponent.value
            )
          );
        }

        if (
          base.type !== "matrix"
        ) {

          throw new Error(
            "Matrix power requires a matrix."
          );
        }

        if (
          exponent.type !== "scalar"
        ) {

          throw new Error(
            "Matrix exponent must be a scalar."
          );
        }

        return makeMatrix(
          Matrix.power(
            base.value,
            exponent.value
          )
        );
      }

      case "binary":

        return evaluateBinary(
          ast.operator,
          ast.left,
          ast.right
        );

      case "function":

        return evaluateFunction(
          ast.name,
          ast.argument
        );

      default:

        throw new Error(
          "Unknown expression."
        );
    }
  }


  function evaluateBinary(
    operator,
    leftAST,
    rightAST
  ) {

    const left =
      evaluate(leftAST);

    const right =
      evaluate(rightAST);


    if (operator === "+") {

      if (
        left.type === "scalar" &&
        right.type === "scalar"
      ) {

        return makeScalar(
          left.value +
          right.value
        );
      }

      if (
        left.type === "identity" &&
        right.type === "matrix"
      ) {

        return makeMatrix(
          Matrix.add(
            resolveIdentity(
              right.value
            ),
            right.value
          )
        );
      }

      if (
        left.type === "matrix" &&
        right.type === "identity"
      ) {

        return makeMatrix(
          Matrix.add(
            left.value,
            resolveIdentity(
              left.value
            )
          )
        );
      }

      if (
        left.type === "identity" &&
        right.type === "identity"
      ) {

        return makeMatrix(
          Matrix.scalarMultiply(
            2,
            resolveIdentity()
          )
        );
      }

      if (
        left.type === "matrix" &&
        right.type === "matrix"
      ) {

        return makeMatrix(
          Matrix.add(
            left.value,
            right.value
          )
        );
      }

      throw new Error(
        "Invalid addition."
      );
    }


    if (operator === "-") {

      if (
        left.type === "scalar" &&
        right.type === "scalar"
      ) {

        return makeScalar(
          left.value -
          right.value
        );
      }

      if (
        left.type === "identity" &&
        right.type === "matrix"
      ) {

        return makeMatrix(
          Matrix.subtract(
            resolveIdentity(
              right.value
            ),
            right.value
          )
        );
      }

      if (
        left.type === "matrix" &&
        right.type === "identity"
      ) {

        return makeMatrix(
          Matrix.subtract(
            left.value,
            resolveIdentity(
              left.value
            )
          )
        );
      }

      if (
        left.type === "matrix" &&
        right.type === "matrix"
      ) {

        return makeMatrix(
          Matrix.subtract(
            left.value,
            right.value
          )
        );
      }

      throw new Error(
        "Invalid subtraction."
      );
    }


    if (operator === "*") {

      if (
        left.type === "scalar" &&
        right.type === "scalar"
      ) {

        return makeScalar(
          left.value *
          right.value
        );
      }

      if (
        left.type === "scalar" &&
        right.type === "matrix"
      ) {

        return makeMatrix(
          Matrix.scalarMultiply(
            left.value,
            right.value
          )
        );
      }

      if (
        left.type === "matrix" &&
        right.type === "scalar"
      ) {

        return makeMatrix(
          Matrix.scalarMultiply(
            right.value,
            left.value
          )
        );
      }

      if (
        left.type === "identity" &&
        right.type === "matrix"
      ) {

        if (
          !isSquare(
            right.value
          )
        ) {

          throw new Error(
            "Identity multiplication requires a square matrix."
          );
        }

        return right;
      }

      if (
        left.type === "matrix" &&
        right.type === "identity"
      ) {

        if (
          !isSquare(
            left.value
          )
        ) {

          throw new Error(
            "Identity multiplication requires a square matrix."
          );
        }

        return left;
      }

      if (
        left.type === "identity" &&
        right.type === "identity"
      ) {

        return makeMatrix(
          resolveIdentity()
        );
      }

      if (
        left.type === "matrix" &&
        right.type === "matrix"
      ) {

        return makeMatrix(
          Matrix.multiply(
            left.value,
            right.value
          )
        );
      }

      throw new Error(
        "Invalid multiplication."
      );
    }


    throw new Error(
      `Unsupported operator "${operator}".`
    );
  }


  /* =======================================================
     FUNCTIONS
     ======================================================= */

  function evaluateFunction(
    name,
    argumentAST
  ) {

    const value =
      evaluate(argumentAST);

    let matrix;

    if (
      value.type === "identity"
    ) {

      matrix =
        resolveIdentity();

    } else if (
      value.type === "matrix"
    ) {

      matrix =
        value.value;

    } else {

      throw new Error(
        `${name}() requires a matrix.`
      );
    }


    switch (name) {

      case "det":

        return makeScalar(
          Matrix.determinant(matrix)
        );

      case "inv":

        return makeMatrix(
          Matrix.inverse(matrix)
        );

      case "ref":

        return makeMatrix(
          Matrix.ref(matrix)
        );

      case "rref":

        return makeMatrix(
          Matrix.rref(matrix)
        );

      case "rank":

        return makeScalar(
          Matrix.rank(matrix)
        );

      case "trace":

        return makeScalar(
          Matrix.trace(matrix)
        );

      case "cofactor":

        return makeMatrix(
          Matrix.cofactor(matrix)
        );

      case "adj":
      case "adjugate":

        return makeMatrix(
          Matrix.adjugate(matrix)
        );

      case "transpose":
      case "trans":

        return makeMatrix(
          Matrix.transpose(matrix)
        );

      case "eigenvalues":

        return {
          type: "eigenvalues",
          value:
            Matrix.eigenvalues(matrix)
        };

      case "eigenvectors":

        return {
          type: "eigenvectors",
          value:
            Matrix.eigenvectors(matrix)
        };

      default:

        throw new Error(
          `Unknown function "${name}".`
        );
    }
  }


  /* =======================================================
     MATRIX VARIABLE MANAGEMENT
     ======================================================= */

  const MAX_MATRICES = 26;


  function indexToLetter(index) {

    return String.fromCharCode(
      65 + index
    );
  }


  function getNextMatrixName() {

    const names =
      Object.keys(
        state.matrices
      ).sort();

    for (
      let index = 0;
      index < MAX_MATRICES;
      index++
    ) {

      const name =
        indexToLetter(index);

      if (
        !names.includes(name)
      ) {

        return name;
      }
    }

    return null;
  }


  function createEmptyMatrix(
    rowCount = 2,
    colCount = 2
  ) {

    return Array.from(
      { length: rowCount },
      () =>
        Array.from(
          { length: colCount },
          () => 0
        )
    );
  }


  function addMatrix() {

    const name =
      getNextMatrixName();

    if (!name) {

      errorMessage.textContent =
        "Matrix limit reached. Only A–Z are available.";

      return;
    }

    errorMessage.textContent =
      "";

    state.matrices[name] =
      createEmptyMatrix(
        2,
        2
      );

    renderMatrices();
  }


  /*
   * Rebuild matrix names after deletion.
   *
   * Example:
   *
   * A B C D
   *     ↓ delete B
   * A B C
   *
   * The old C becomes B and the old D becomes C.
   *
   * Matrix values are copied, so deleting a matrix
   * does not destroy the remaining matrix data.
   */
  function compactMatrixNames() {

    const names =
      Object.keys(
        state.matrices
      ).sort();

    const compacted = {};

    names.forEach(
      (oldName, index) => {

        const newName =
          indexToLetter(index);

        compacted[newName] =
          cloneMatrix(
            state.matrices[oldName]
          );
      }
    );

    state.matrices =
      compacted;
  }


  function deleteMatrix(name) {

    if (
      !Object.prototype.hasOwnProperty.call(
        state.matrices,
        name
      )
    ) {
      return;
    }

    delete state.matrices[name];

    compactMatrixNames();

    errorMessage.textContent =
      "";

    renderMatrices();
  }


  function resizeMatrix(
    name,
    newRows,
    newCols
  ) {

    const matrix =
      state.matrices[name];

    if (!matrix) {
      return;
    }

    const oldRows =
      rows(matrix);

    const oldCols =
      cols(matrix);

    const result =
      Array.from(
        { length: newRows },
        (_, i) =>
          Array.from(
            { length: newCols },
            (_, j) =>
              i < oldRows &&
              j < oldCols
                ? matrix[i][j]
                : 0
          )
      );

    state.matrices[name] =
      result;

    renderMatrices();
  }


  /* =======================================================
     RENDER MATRICES
     ======================================================= */

  function renderMatrices() {

    matricesContainer.innerHTML =
      "";

    const names =
      Object.keys(
        state.matrices
      ).sort();

    emptyMatrices.hidden =
      names.length !== 0;

    const matrixLimitReached =
      names.length >= MAX_MATRICES;

    addMatrixButton.disabled =
      matrixLimitReached;

    addMatrixButton.title =
      matrixLimitReached
        ? "Maximum of 26 matrices (A–Z)"
        : "Add matrix";


    names.forEach(name => {

      const matrix =
        state.matrices[name];

      const card =
        document.createElement(
          "div"
        );

      card.className =
        "matrix-card";


      const header =
        document.createElement(
          "div"
        );

      header.className =
        "matrix-header";


      const heading =
        document.createElement(
          "div"
        );

      heading.className =
        "matrix-heading";


      const nameBadge =
        document.createElement(
          "div"
        );

      nameBadge.className =
        "matrix-name";

      nameBadge.textContent =
        name;


      const size =
        document.createElement(
          "div"
        );

      size.className =
        "matrix-size";

      size.textContent =
        `${rows(matrix)} × ${cols(matrix)}`;


      heading.appendChild(
        nameBadge
      );

      heading.appendChild(
        size
      );


      const actions =
        document.createElement(
          "div"
        );

      actions.className =
        "matrix-actions";


      const addRow =
        createMatrixAction(
          "+ row",
          () => {

            resizeMatrix(
              name,
              rows(matrix) + 1,
              cols(matrix)
            );
          }
        );


      const removeRow =
        createMatrixAction(
          "− row",
          () => {

            if (
              rows(matrix) > 1
            ) {

              resizeMatrix(
                name,
                rows(matrix) - 1,
                cols(matrix)
              );
            }
          }
        );


      const addColumn =
        createMatrixAction(
          "+ col",
          () => {

            resizeMatrix(
              name,
              rows(matrix),
              cols(matrix) + 1
            );
          }
        );


      const removeColumn =
        createMatrixAction(
          "− col",
          () => {

            if (
              cols(matrix) > 1
            ) {

              resizeMatrix(
                name,
                rows(matrix),
                cols(matrix) - 1
              );
            }
          }
        );


      const deleteButton =
        createMatrixAction(
          "×",
          () =>
            deleteMatrix(name)
        );

      deleteButton.classList.add(
        "delete"
      );


      actions.append(
        addRow,
        removeRow,
        addColumn,
        removeColumn,
        deleteButton
      );


      header.append(
        heading,
        actions
      );


      const gridWrapper =
        document.createElement(
          "div"
        );

      gridWrapper.className =
        "matrix-grid-wrapper";


      const grid =
        document.createElement(
          "div"
        );

      grid.className =
        "matrix-grid";

      grid.style.gridTemplateColumns =
        `repeat(${cols(matrix)}, 64px)`;


      for (
        let i = 0;
        i < rows(matrix);
        i++
      ) {

        for (
          let j = 0;
          j < cols(matrix);
          j++
        ) {

          const input =
            document.createElement(
              "input"
            );

          input.className =
            "matrix-cell";

          input.type =
            "text";

          input.inputMode =
            "decimal";

          input.autocomplete =
            "off";

          input.value =
            formatNumber(
              matrix[i][j]
            );

          input.dataset.matrix =
            name;

          input.dataset.row =
            i;

          input.dataset.col =
            j;


          input.addEventListener(
            "input",
            () => {

              const value =
                Number(
                  input.value
                );

              state.matrices[name][i][j] =
                Number.isFinite(value)
                  ? value
                  : 0;
            }
          );


          input.addEventListener(
            "change",
            () => {

              const value =
                Number(
                  input.value
                );

              state.matrices[name][i][j] =
                Number.isFinite(value)
                  ? value
                  : 0;

              input.value =
                formatNumber(
                  state.matrices[name][i][j]
                );
            }
          );


          grid.appendChild(
            input
          );
        }
      }


      gridWrapper.appendChild(
        grid
      );


      card.append(
        header,
        gridWrapper
      );


      matricesContainer.appendChild(
        card
      );
    });
  }


  function createMatrixAction(
    text,
    handler
  ) {

    const button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    button.className =
      "matrix-action";

    button.textContent =
      text;

    button.addEventListener(
      "click",
      handler
    );

    return button;
  }


  /* =======================================================
     RESULT RENDERING
     ======================================================= */

  function renderResult(result) {

    resultContainer.innerHTML =
      "";

    if (!result) {

      resultContainer.innerHTML =
        `<div class="result-empty"></div>`;

      return;
    }

    if (
      result.type === "scalar"
    ) {

      const scalar =
        document.createElement(
          "div"
        );

      scalar.className =
        "result-scalar";

      scalar.textContent =
        formatNumber(
          result.value
        );

      resultContainer.appendChild(
        scalar
      );

      return;
    }

    if (
      result.type === "matrix"
    ) {

      renderMatrixResult(
        result.value
      );

      return;
    }

    if (
      result.type === "eigenvalues"
    ) {

      renderEigenvalues(
        result.value
      );

      return;
    }

    if (
      result.type === "eigenvectors"
    ) {

      renderEigenvectors(
        result.value
      );

      return;
    }

    resultContainer.innerHTML =
      `<div class="result-empty">No result</div>`;
  }


  function renderMatrixResult(
    matrix
  ) {

    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.className =
      "result-matrix-wrapper";


    const grid =
      document.createElement(
        "div"
      );

    grid.className =
      "result-matrix";

    grid.style.gridTemplateColumns =
      `repeat(${cols(matrix)}, minmax(64px, auto))`;


    matrix.forEach(row => {

      row.forEach(value => {

        const cell =
          document.createElement(
            "div"
          );

        cell.className =
          "result-cell";

        cell.textContent =
          formatNumber(value);

        grid.appendChild(
          cell
        );
      });
    });


    wrapper.appendChild(
      grid
    );

    resultContainer.appendChild(
      wrapper
    );
  }


  function renderEigenvalues(
    values
  ) {

    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.className =
      "result-matrix-wrapper";


    const grid =
      document.createElement(
        "div"
      );

    grid.className =
      "result-matrix";

    grid.style.gridTemplateColumns =
      `repeat(${values.length}, minmax(90px, auto))`;


    values.forEach(value => {

      const cell =
        document.createElement(
          "div"
        );

      cell.className =
        "result-cell";


      if (
        typeof value === "object"
      ) {

        const real =
          formatNumber(
            value.real
          );

        const imaginary =
          formatNumber(
            Math.abs(
              value.imaginary
            )
          );

        const sign =
          value.imaginary >= 0
            ? "+"
            : "-";

        cell.textContent =
          `${real} ${sign} ${imaginary}i`;

      } else {

        cell.textContent =
          formatNumber(value);
      }

      grid.appendChild(
        cell
      );
    });


    wrapper.appendChild(
      grid
    );

    resultContainer.appendChild(
      wrapper
    );
  }


  function renderEigenvectors(
    values
  ) {

    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.className =
      "result-matrix-wrapper";


    const grid =
      document.createElement(
        "div"
      );

    grid.className =
      "result-matrix";

    grid.style.gridTemplateColumns =
      "repeat(2, minmax(90px, auto))";


    values.forEach(item => {

      const eigenvalue =
        document.createElement(
          "div"
        );

      eigenvalue.className =
        "result-cell";

      eigenvalue.textContent =
        typeof item.eigenvalue === "object"
          ? `${formatNumber(item.eigenvalue.real)} ${item.eigenvalue.imaginary >= 0 ? "+" : "-"} ${formatNumber(Math.abs(item.eigenvalue.imaginary))}i`
          : formatNumber(
              item.eigenvalue
            );


      const vector =
        document.createElement(
          "div"
        );

      vector.className =
        "result-cell";


      if (!item.vector) {

        vector.textContent =
          "complex";

      } else {

        vector.textContent =
          `[${item.vector.map(formatNumber).join(", ")}]`;
      }


      grid.append(
        eigenvalue,
        vector
      );
    });


    wrapper.appendChild(
      grid
    );

    resultContainer.appendChild(
      wrapper
    );
  }


  /* =======================================================
     CALCULATION
     ======================================================= */

  function calculate() {

    const expression =
      expressionInput.value.trim();

    errorMessage.textContent =
      "";

    if (!expression) {
      return;
    }


    try {

      const tokens =
        tokenize(expression);

      const parser =
        new Parser(tokens);

      const ast =
        parser.parse();

      const result =
        evaluate(ast);

      renderResult(result);

      addHistory(
        expression
      );

    } catch (error) {

      resultContainer.innerHTML =
        "";

      errorMessage.textContent =
        error.message ||
        "Unable to calculate expression.";
    }
  }


  /* =======================================================
     HISTORY
     ======================================================= */

  function addHistory(
    expression
  ) {

    state.history.unshift(
      expression
    );

    state.history =
      state.history.slice(
        0,
        20
      );

    renderHistory();
  }


  function renderHistory() {

    historyContainer.innerHTML =
      "";

    if (!state.history.length) {

      historyContainer.innerHTML =
        `<div class="history-empty"></div>`;

      return;
    }


    state.history.forEach(
      (expression, index) => {

        const item =
          document.createElement(
            "div"
          );

        item.className =
          "history-item";

        item.title =
          expression;


        const expressionElement =
          document.createElement(
            "div"
          );

        expressionElement.className =
          "history-expression";

        expressionElement.textContent =
          expression;


        const indexElement =
          document.createElement(
            "div"
          );

        indexElement.className =
          "history-index";

        indexElement.textContent =
          `#${index + 1}`;


        item.append(
          expressionElement,
          indexElement
        );


        item.addEventListener(
          "click",
          () => {

            expressionInput.value =
              expression;

            expressionInput.focus();
          }
        );


        historyContainer.appendChild(
          item
        );
      }
    );
  }


  function clearHistory() {

    state.history = [];

    renderHistory();
  }


  /* =======================================================
     MENU
     ======================================================= */

  function setMenu(open) {

    sideMenu.classList.toggle(
      "is-open",
      open
    );

    menuBackdrop.classList.toggle(
      "is-visible",
      open
    );

    menuButton.textContent =
      open
        ? "×"
        : "≡";

    menuButton.setAttribute(
      "aria-expanded",
      String(open)
    );

    menuButton.setAttribute(
      "aria-label",
      open
        ? "Close menu"
        : "Open menu"
    );

    sideMenu.setAttribute(
      "aria-hidden",
      String(!open)
    );
  }


  function toggleMenu() {

    const open =
      sideMenu.classList.contains(
        "is-open"
      );

    setMenu(!open);
  }


  menuButton.addEventListener(
    "click",
    toggleMenu
  );


  menuBackdrop.addEventListener(
    "click",
    () =>
      setMenu(false)
  );


  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape" &&
        sideMenu.classList.contains(
          "is-open"
        )
      ) {

        setMenu(false);
      }
    }
  );


  /* =======================================================
     SECTION COLLAPSE
     ======================================================= */

  function setupSectionToggle(
    toggle,
    content
  ) {

    toggle.addEventListener(
      "click",
      () => {

        const expanded =
          toggle.getAttribute(
            "aria-expanded"
          ) === "true";

        const nextState =
          !expanded;

        toggle.setAttribute(
          "aria-expanded",
          String(nextState)
        );

        content.hidden =
          !nextState;

        const arrow =
          toggle.querySelector(
            ".section-arrow"
          );

        arrow.textContent =
          nextState
            ? "∧"
            : "∨";
      }
    );
  }


  setupSectionToggle(
    settingsToggle,
    settingsContent
  );


  setupSectionToggle(
    commandsToggle,
    commandsContent
  );


  /* =======================================================
     DISPLAY MODE
     ======================================================= */

  function applyTheme(theme, save = true) {
    if (!["light", "dark", "auto"].includes(theme)) {
      theme = "light";
    }

    const root = document.documentElement;

    const resolvedTheme =
      theme === "auto"
        ? (
            window.matchMedia("(prefers-color-scheme: dark)").matches
              ? "dark"
              : "light"
          )
        : theme;

    root.dataset.theme = resolvedTheme;

    updateThemeButtons(theme);

    if (save) {
      try {
        localStorage.setItem("matrix-calculator-theme", theme);

        // Notify the shared theme system if it exists.
        if (typeof window.setCalQTheme === "function") {
          window.setCalQTheme(theme);
        }

        // Keep the launcher and other apps synchronized.
        localStorage.setItem("calq-display-mode", theme);
      } catch (error) {
        console.error("Theme synchronization error:", error);
      }
    }
  }


  function updateThemeButtons(theme) {
    document.querySelectorAll(".display-option").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.theme === theme
      );
    });
  }


  document.querySelectorAll(".display-option").forEach(button => {
    button.addEventListener("click", () => {
      applyTheme(button.dataset.theme, true);
    });
  });


  const savedTheme =
    localStorage.getItem("calq-display-mode") ||
    localStorage.getItem("matrix-calculator-theme") ||
    "light";

  applyTheme(savedTheme, false);


  window.matchMedia("(prefers-color-scheme: dark)").addEventListener(
    "change",
    () => {
      const theme =
        localStorage.getItem("calq-display-mode") ||
        localStorage.getItem("matrix-calculator-theme");

      if (theme === "auto") {
        applyTheme("auto", false);
      }
    }
  );


  /* =======================================================
     EVENTS
     ======================================================= */

  calculateButton.addEventListener(
    "click",
    calculate
  );


  expressionInput.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter"
      ) {

        event.preventDefault();

        calculate();
      }
    }
  );


  clearHistoryButton.addEventListener(
    "click",
    clearHistory
  );


  addMatrixButton.addEventListener(
    "click",
    addMatrix
  );


  /* =======================================================
     INITIAL STATE
     ======================================================= */

  state.matrices = {};

  renderMatrices();
  renderHistory();
  renderResult(null);

})();